import { isMacroImport } from '../macros.ts';
import type {
  Attribute,
  Block,
  Body,
  DynamicTagNode,
  ForBlock,
  Markup,
  RepeatBlock,
  SFCFile,
} from '../ast.ts';
import { tryCatchesClient } from '../graph.ts';
import type { GraphNode } from '../graph.ts';
import { isWithin } from '../model.ts';
import type { Declaration, Diagnostic, Scope, Site } from '../model.ts';
import { getPatternNames } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
import { blockBodies, holderArguments, serverFunctionId } from '../plan.ts';
import type { Plan } from '../plan.ts';
import { cloneLines } from './template.ts';
import type { Fill } from './markup.ts';
import { Emitter, classText, decodeAttribute, literalClasses, variableValue } from './markup.ts';
import { Patch, addValueEdits } from './patch.ts';
import { clientModuleScript, componentNames, renderImport } from './render.ts';
import type { SharedContext } from '../shared-module.ts';
import { Rewriter } from './rewrite.ts';
import { instanceScope, scopePath, slotIndex } from './scopes.ts';
import { copy, unmarked } from '../sourcemap.ts';

export interface ClientOutput {
  /** The entry module: the component ID, its props, its update table and its part loaders. */
  code: string;
  /**
   * The parts, by name. `h<n>` and `c<n>` parts hold one client root each,
   * `update` holds the code that updates the page, and `shared` holds the
   * functions that more than one part calls.
   */
  parts: Record<string, string>;
  /** The ID, the props map, the update table and the refresh table: what the page depends on. */
  table: string;
  /**
   * The parts that each export part loads, by name: its own first, then the
   * ones it starts loading with it. Empty when the entry holds the code.
   */
  loaders: Record<string, string[]>;
  /** False when nothing of the component runs in the browser. */
  clientCode: boolean;
  /**
   * The render functions of the client entry that fill a nested `#if` or `#for` of a clone,
   * for the render module, which imports them.
   */
  fillOf: (block: Block) => Fill | undefined;
  diagnostics: Diagnostic[];
}

/**
 * About the size of code after a minifier: without comments, extra
 * whitespace and long generated names. Merging parts compares it.
 */
export function minifiedSize(code: string): number {
  return code
    .replace(/\/\*[\s\S]*?\*\/|^\s*\/\/[^\n]*/gm, '')
    .replace(/\$\$\w+/g, 'e')
    .replace(/\s+/g, ' ')
    .replace(/ ?([{}()[\];,:=+\-*/<>!?&|.]) ?/g, '$1').length;
}

/**
 * The `merge` of the Vite plugin. Below it, one module costs less than the
 * entry and the parts that a first event loads: each file has its own
 * request, imports and gzip header, and the parts wait for the entry.
 */
export const DEFAULT_MERGE = 4096;

/** The part that holds an export of a client module. */
export function partOf(name: string): string {
  return /^[hct]\d/.test(name) ? name : 'update';
}

// Sites whose code does not run while a body renders.
// Sites that run only in the browser, where a component is its render function and not a stub.
const BROWSER_ONLY_SITES = new Set(['server-function', 'event', 'effect', 'client']);
const DEFERRED_SITES = new Set(['function', 'server-function', 'event', 'effect', 'client']);

/**
 * Generates the client entry and its parts. When the parts are smaller than
 * `merge` bytes in all, after minifying, the entry holds their code itself,
 * so the first event loads one module instead of several.
 */
export function generateClient(
  file: SFCFile,
  plan: Plan,
  merge = 0,
  shared?: SharedContext,
): ClientOutput {
  return new ClientGenerator(file, plan, merge, shared).generate();
}

class ClientGenerator {
  private readonly file: SFCFile;
  private readonly plan: Plan;
  private readonly diagnostics: Diagnostic[] = [];
  private readonly rewriter: Rewriter;
  private readonly valuePatch: Patch;
  /** Code by part. */
  private readonly out = new Map<string, string[]>();
  /** The part that `emit` writes to. */
  private part = 'update';
  /** The sites whose code each part holds, before functions are placed. */
  private readonly reach = new Map<string, Set<Site>>();
  /** The part of each client function. */
  private readonly placement = new Map<Declaration, string>();
  private readonly live = new Map<Site, GraphNode>();
  /** The export that updates each live node. */
  private readonly updates = new Map<GraphNode, string>();
  /** Bodies that the client renders, by scope. */
  private readonly renders = new Map<Scope, { body: Body; block: Block }>();

  private readonly merge: number;
  private readonly shared: SharedContext | undefined;

  constructor(file: SFCFile, plan: Plan, merge: number, shared?: SharedContext) {
    this.merge = merge;
    this.file = file;
    this.plan = plan;
    this.shared = shared;
    this.rewriter = new Rewriter(file, plan, this.diagnostics, shared);
    this.valuePatch = new Patch(file.source);
    addValueEdits(this.valuePatch, file, plan.graph.model.sites, 'client');
    for (const node of plan.graph.nodes) {
      if (node.kind !== 'source' && plan.graph.live.has(node)) {
        this.live.set(node.site, node);
      }
    }
  }

  private get model() {
    return this.plan.graph.model;
  }

  private error(message: string, range: { start: number; end: number }): void {
    this.diagnostics.push({
      severity: 'error',
      message,
      range: { start: range.start, end: range.end },
    });
  }

  private emit(code: string): void {
    const lines = this.out.get(this.part) ?? [];
    this.out.set(this.part, lines);
    lines.push(code);
  }

  /** The module constants of each part, by their code. */
  private readonly constants = new Map<string, Map<string, string>>();
  private constantCount = 0;

  /**
   * A constant of the module of the current part, such as a list of scope kinds or a key
   * function that reads no scope, so an update does not make it again on each run.
   */
  private hoist(code: string): string {
    let known = this.constants.get(this.part);
    if (!known) {
      known = new Map();
      this.constants.set(this.part, known);
    }
    let name = known.get(code);
    if (!name) {
      // The parts of a small component share one module, so the names differ between parts.
      name = `$$k${this.constantCount++}`;
      known.set(code, name);
      this.emit(`const ${name} = ${code};`);
    }
    return name;
  }

  generate(): ClientOutput {
    this.collectRenders();
    this.checkSupport();
    this.placeCode();

    this.emitFunctions();
    this.emitRoots();
    this.part = 'update';
    this.emitUpdates();
    this.emitWindowStarts();
    this.emitRenders();
    this.emitChildrenRenders();

    const parts: Record<string, string> = {};
    for (const name of new Set([...this.out.keys(), ...this.reach.keys()])) {
      // A component whose updates are all on the server has no `update` part.
      if (name !== 'shared' && (this.out.get(name)?.length ?? 0) > 0) {
        parts[name] = this.assemble(name);
      }
    }
    if (this.out.has('shared') || this.usesModuleScript()) {
      parts.shared = this.assembleShared();
    }
    const names = Object.keys(parts).filter((name) => name !== 'shared');
    // The minified size decides, because that is what the browser loads.
    const size = Object.values(parts).reduce((total, code) => total + minifiedSize(code), 0);
    const merged = !parts.shared && names.length > 0 && size < this.merge;
    if (merged) {
      for (const name of names) {
        delete parts[name];
      }
      parts.all = this.assembleAll(names);
    }
    // A part that calls shared code of module functions imports their shared modules.
    for (const [name, code] of Object.entries(parts)) {
      const used = new Set([...code.matchAll(/\$\$m(\d+)\./g)].map((match) => Number(match[1])));
      if (used.size > 0) {
        const imports = [...used].map(
          (index) =>
            `import * as $$m${index} from ${JSON.stringify(this.shared!.specifiers[index])};`,
        );
        parts[name] = `${imports.join('\n')}\n${code}`;
      }
    }
    const refresh = this.refreshTable();
    const tries = this.triesTable();
    const table = [
      `export const id = ${JSON.stringify(this.plan.id)};`,
      `export const props = ${this.propsMap()};`,
      `export const g = ${this.table()};`,
      ...(refresh ? [`export const refresh = ${refresh};`] : []),
      ...(tries ? [`export const t = ${tries};`] : []),
    ];
    // The state holds a component that a prop gets as its ID, so the core finds its render
    // function in the entry of the component that sent it.
    const values = this.valueComponents();
    const sent = values.map((_, index) => `$$v${index}`);
    const registered =
      values.length > 0
        ? [
            ...values.map((code, index) => code.replace('$$v', () => sent[index]!)),
            `export const components = [${sent.join(', ')}];`,
          ]
        : [];
    const clientCode = names.length > 0 || values.length > 0;
    if (merged || names.length === 0) {
      // The entry holds the code itself, so the first event loads one module. An entry
      // without `load` is its own only part.
      const code = parts.all ?? '';
      delete parts.all;
      return {
        code: [code, ...registered, ...table, ''].join('\n'),
        table: table.join('\n'),
        parts,
        loaders: Object.fromEntries(names.map((name) => [name, []])),
        clientCode,
        fillOf: (block) => this.fillOf(block),
        diagnostics: this.diagnostics,
      };
    }
    // The page loads every part of a component with it, so the entry exports them, and a bundle
    // of the page holds them with the entry. The names of the parts' exports are their own.
    const loaders: Record<string, string[]> = {};
    for (const name of names) {
      loaders[name] = [name];
    }
    const entry = [
      ...names.map((name) => `export * from ${JSON.stringify(this.partPath(name))};`),
      ...registered,
      ...table,
      '',
    ];
    return {
      code: entry.join('\n'),
      table: table.join('\n'),
      parts,
      loaders,
      clientCode,
      fillOf: (block) => this.fillOf(block),
      diagnostics: this.diagnostics,
    };
  }

  /**
   * The imports, as `import $$v from …`, of the components that markup or script reads as values,
   * such as `as=Link`. A server render can send one in the page state, as its ID.
   */
  private valueComponents(): string[] {
    const result: string[] = [];
    for (const declaration of this.model.declarations) {
      const imported = declaration.imported;
      if (
        declaration.kind !== 'import' ||
        !imported?.source.endsWith('.brm') ||
        !declaration.reads.some((read) => !BROWSER_ONLY_SITES.has(read.site.kind))
      ) {
        continue;
      }
      const name = imported.name === 'default' ? '$$v' : `{ ${imported.name} as $$v }`;
      result.push(`import ${name} from ${JSON.stringify(`${imported.source}?brumate-render`)};`);
    }
    return result;
  }

  /** The import path of a part, relative to the component's file. */
  private partPath(name: string): string {
    const base = this.file.filename.split(/[\\/]/).pop()!;
    return `./${base}?brumate-client&part=${name}`;
  }

  /** Follows the client functions that sites call. */
  private closure(seed: Iterable<Site>): Set<Site> {
    const result = new Set<Site>();
    const visit = (site: Site): void => {
      if (result.has(site)) {
        return;
      }
      result.add(site);
      for (const callee of site.calls) {
        if (callee.kind === 'function' && callee.site) {
          visit(callee.site);
        }
      }
    };
    for (const site of seed) {
      visit(site);
    }
    return result;
  }

  /** Decides which part holds each client root, update and function. */
  private placeCode(): void {
    for (const [site, symbol] of this.plan.symbols) {
      this.reach.set(symbol, this.closure([site]));
    }
    const updates = [...this.plan.clientSites].filter(
      (site) =>
        !this.plan.symbols.has(site) && site.kind !== 'function' && site.kind !== 'server-function',
    );
    for (const scope of this.renderedScopes()) {
      for (const site of this.model.sites) {
        if (isWithin(site.scope, scope) && !DEFERRED_SITES.has(site.kind)) {
          updates.push(site);
        }
      }
    }
    this.reach.set('update', this.closure(updates));
    for (const declaration of this.model.declarations) {
      const site = declaration.site;
      if (declaration.kind !== 'function' || !site || !this.plan.clientSites.has(site)) {
        continue;
      }
      const users = [...this.reach].filter(([, sites]) => sites.has(site)).map(([name]) => name);
      this.placement.set(declaration, users.length === 1 ? users[0]! : 'shared');
    }
  }

  /** The sites whose code a part holds: its own sites and the functions placed in it. */
  private partSites(name: string): Site[] {
    const result: Site[] = [];
    for (const site of this.reach.get(name) ?? []) {
      const declaration = site.declaration;
      if (site.kind === 'function' && declaration) {
        if (this.placement.get(declaration) === name) {
          result.push(site);
        }
      } else {
        result.push(site);
      }
    }
    if (name === 'shared') {
      for (const [declaration, part] of this.placement) {
        if (part === 'shared') {
          result.push(declaration.site!);
        }
      }
    }
    return result;
  }

  private reads(sites: Site[]): Set<Declaration> {
    const result = new Set<Declaration>();
    for (const site of sites) {
      // Shared code of a module function imports what it needs itself. The part only builds its
      // cells, which read values and functions of the component. Code whose names have no value
      // in the browser, such as a constant of the module script, is copied with its imports.
      const shared =
        this.rewriter.sharedCall(site, '$$s', instanceScope(this.plan, site.scope)) !== undefined;
      for (const read of site.reads) {
        if (!shared || read.declaration.kind !== 'import') {
          result.add(read.declaration);
        }
      }
    }
    return result;
  }

  /** The import statements for the names that some code reads. */
  private importsFor(
    names: Set<string>,
    components: boolean | Scope[],
    withChildren = components === true,
  ): string[] {
    // `true` for the scopes that render functions render, or the scopes of a template part.
    const rendered = components === true ? this.renderedScopes() : components || [];
    for (const scope of rendered) {
      componentNames(scope.body?.children ?? [], names);
      // A component named in an attribute value, such as `as=Link`, is a read of the markup.
      for (const site of this.model.sites) {
        if (isWithin(site.scope, scope) && !DEFERRED_SITES.has(site.kind)) {
          for (const read of site.reads) {
            if (read.declaration.kind === 'import') {
              names.add(read.declaration.name);
            }
          }
        }
      }
    }
    // The renders of children are in the update part, with the components that they render.
    if (withChildren) {
      for (const node of this.plan.childrenRenders.keys()) {
        componentNames(node.children, names);
      }
    }
    const result: string[] = [];
    for (const program of this.programs()) {
      if (program === this.file.moduleScript?.program) {
        continue;
      }
      for (const statement of program.body) {
        if (statement.type === 'ImportDeclaration') {
          const code = renderImport(this.file, statement, names);
          if (code) {
            result.push(code);
          }
        }
      }
    }
    return result;
  }

  private programs(): oxc.Program[] {
    const result: oxc.Program[] = [];
    if (this.file.moduleScript) {
      result.push(this.file.moduleScript.program);
    }
    if (this.file.instanceScript) {
      result.push(this.file.instanceScript.program);
    }
    for (const scope of this.model.scopes) {
      if (scope.body?.script && !result.includes(scope.body.script.program)) {
        result.push(scope.body.script.program);
      }
    }
    return result;
  }

  private assemble(name: string): string {
    const reads = this.reads(this.partSites(name));
    const names = new Set(
      [...reads].filter((item) => item.kind === 'import').map((item) => item.name),
    );
    const shared = [...reads]
      .filter(
        (item) =>
          (item.kind === 'function' && this.placement.get(item) === 'shared') ||
          (item.kind === 'module' && item.scope === this.model.module),
      )
      .map((item) => (item.kind === 'function' ? `${item.name}$` : item.name));
    const lines = [
      "import * as $$b from 'brumate/client';",
      ...this.importsFor(names, name === 'update' || this.templateScopes(name)),
    ];
    if (shared.length > 0) {
      lines.push(
        `import { ${[...new Set(shared)].join(', ')} } from ${JSON.stringify(this.partPath('shared'))};`,
      );
    }
    lines.push('', ...this.serverStubs([name]), ...(this.out.get(name) ?? []), '');
    return lines.join('\n');
  }

  /** One module with the code of every part, for a small component. */
  private assembleAll(names: string[]): string {
    const imports = new Set<string>();
    for (const name of names) {
      for (const item of this.reads(this.partSites(name))) {
        if (item.kind === 'import') {
          imports.add(item.name);
        }
      }
    }
    const lines = [
      "import * as $$b from 'brumate/client';",
      ...this.importsFor(
        imports,
        [...this.renderedScopes(), ...names.flatMap((name) => this.templateScopes(name))],
        names.includes('update'),
      ),
      '',
      ...this.serverStubs(names),
    ];
    for (const name of names) {
      lines.push('', ...(this.out.get(name) ?? []));
    }
    lines.push('');
    return lines.join('\n');
  }

  private assembleShared(): string {
    const reads = this.reads(this.partSites('shared'));
    const names = new Set(
      [...reads].filter((item) => item.kind === 'import').map((item) => item.name),
    );
    const lines = ["import * as $$b from 'brumate/client';", ...this.importsFor(names, false)];
    if (this.usesModuleScript()) {
      for (const statement of this.file.moduleScript!.program.body) {
        if (statement.type === 'ImportDeclaration' && !isMacroImport(statement)) {
          lines.push(copy(this.file.source, statement.start, statement.end));
        }
      }
      lines.push(...clientModuleScript(this.file, this.plan));
      const exported = new Set<string>();
      for (const statement of this.file.moduleScript!.program.body) {
        if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
          for (const declaration of this.model.module.declarations.values()) {
            if (
              declaration.range.start >= statement.start &&
              declaration.range.end <= statement.end
            ) {
              exported.add(declaration.name);
            }
          }
        }
      }
      const rest = [...this.model.module.declarations.values()]
        .filter((declaration) => declaration.kind === 'module' && !exported.has(declaration.name))
        .map((declaration) => declaration.name);
      if (rest.length > 0) {
        lines.push(`export { ${rest.join(', ')} };`);
      }
    }
    lines.push('', ...this.serverStubs(['shared']), ...(this.out.get('shared') ?? []), '');
    return lines.join('\n');
  }

  // Checks

  private checkSupport(): void {
    const rendered = this.renderedScopes();
    for (const site of this.model.sites) {
      const live = this.live.has(site);
      if (live && site.kind === 'tag' && !(site.owner as DynamicTagNode | undefined)?.keyed) {
        this.error('A dynamic tag that changes on the client is not supported yet', site.range);
      }
      // A render function or an update runs without waiting, so it can await only a memo, whose
      // value is settled in the browser. A memo that awaits a promise loads it instead.
      if (
        site.awaits &&
        site.kind !== 'memo' &&
        !DEFERRED_SITES.has(site.kind) &&
        (live || rendered.some((scope) => isWithin(site.scope, scope)))
      ) {
        this.error(
          live
            ? 'Code that the browser updates can await only a memo. Load the promise in a memo instead'
            : 'Markup that the browser renders can await only a memo. Load the promise in a memo instead',
          site.range,
        );
      }
    }
  }

  // Imports and module code

  private clientReads(): Set<Declaration> {
    const reads = new Set<Declaration>();
    for (const site of this.plan.clientSites) {
      for (const read of site.reads) {
        reads.add(read.declaration);
      }
    }
    for (const scope of this.renderedScopes()) {
      for (const site of this.model.sites) {
        if (isWithin(site.scope, scope)) {
          for (const read of site.reads) {
            reads.add(read.declaration);
          }
        }
      }
    }
    return reads;
  }

  private usesModuleScript(): boolean {
    return [...this.clientReads()].some((declaration) => declaration.kind === 'module');
  }

  /**
   * The scopes of the templates that a template part renders, such as a template that is passed
   * to a component as a prop, which can render components of its own.
   */
  private templateScopes(part: string): Scope[] {
    const result: Scope[] = [];
    for (const [site, symbol] of this.plan.symbols) {
      if (symbol !== part || !symbol.startsWith('t')) {
        continue;
      }
      for (const callee of site.calls) {
        const template =
          callee.kind === 'template'
            ? this.model.scopes.find(
                (item) => item.template?.name === callee.name && item.parent === callee.scope,
              )
            : undefined;
        if (template) {
          result.push(...this.inside(template));
        }
      }
    }
    return result;
  }

  /** Every scope that a render function of this module renders, including templates. */
  private renderedScopes(): Scope[] {
    const result = new Set<Scope>();
    for (const scope of this.renders.keys()) {
      for (const item of this.inside(scope)) {
        result.add(item);
      }
    }
    return [...result];
  }

  /** A body scope and the template scopes that it calls, directly or through other templates. */
  private inside(scope: Scope): Scope[] {
    const result: Scope[] = [scope];
    for (let i = 0; i < result.length; i++) {
      const current = result[i]!;
      for (const site of this.model.sites) {
        if (!isWithin(site.scope, current) || DEFERRED_SITES.has(site.kind)) {
          continue;
        }
        for (const callee of site.calls) {
          if (callee.kind !== 'template') {
            continue;
          }
          const template = this.model.scopes.find(
            (item) => item.template?.name === callee.name && item.parent === callee.scope,
          );
          if (template && !result.includes(template)) {
            result.push(template);
          }
        }
      }
    }
    return result;
  }

  /**
   * The scopes of a list that nothing else in it declares. A template that sits within a
   * scope of the list is emitted where its `#template` is, so a render emits only the others.
   */
  private declared(list: Scope[]): Scope[] {
    return list.filter(
      (item, index) => !list.slice(0, index).some((other) => isWithin(item, other)),
    );
  }

  private propsMap(): string {
    const entries: string[] = [];
    for (const statement of this.file.instanceScript?.program.body ?? []) {
      if (statement.type !== 'VariableDeclaration') {
        continue;
      }
      for (const declarator of statement.declarations) {
        const init = declarator.init;
        if (
          !(
            init?.type === 'CallExpression' &&
            init.callee.type === 'Identifier' &&
            init.callee.name === '$props'
          )
        ) {
          continue;
        }
        const component = this.model.component;
        if (declarator.id.type === 'Identifier') {
          const slot = slotIndex(this.plan, component.declarations.get(declarator.id.name)!);
          if (slot !== -1) {
            entries.push(`"*": ${slot}`);
          }
        } else if (declarator.id.type === 'ObjectPattern') {
          for (const property of declarator.id.properties) {
            if (property.type === 'RestElement') {
              // The rest gets the props that have no name of their own, under `...`.
              const [name] = getPatternNames(property.argument);
              const declaration = name && component.declarations.get(name.name);
              const slot = declaration ? slotIndex(this.plan, declaration) : -1;
              if (slot !== -1) {
                entries.push(`"...": ${slot}`);
              }
              continue;
            }
            if (property.computed) {
              continue;
            }
            const key =
              property.key.type === 'Identifier'
                ? property.key.name
                : String((property.key as { value?: unknown }).value);
            const [name] = getPatternNames(property.value);
            const declaration = name && component.declarations.get(name.name);
            const slot = declaration ? slotIndex(this.plan, declaration) : -1;
            if (slot !== -1) {
              entries.push(`${JSON.stringify(key)}: ${slot}`);
            }
          }
        }
      }
    }
    return `{ ${entries.join(', ')} }`;
  }

  // Functions

  /**
   * A stub for each server function that some parts call, also one of the
   * module script. A merged module gets each stub once.
   */
  private serverStubs(names: string[]): string[] {
    const result = new Set<string>();
    for (const name of names) {
      for (const declaration of this.reads(this.partSites(name))) {
        if (declaration.kind === 'server-function') {
          const ref = serverFunctionId(this.plan, declaration.name);
          result.add(
            `const ${declaration.name}$ = (...$$a) => $$b.rpc(${JSON.stringify(ref)}, $$a);`,
          );
        }
      }
    }
    return [...result];
  }

  private emitFunctions(): void {
    for (const declaration of this.model.declarations) {
      const site = declaration.site;
      if (declaration.kind !== 'function' || !site || !this.plan.clientSites.has(site)) {
        continue;
      }
      const fn = site.node as oxc.Function | oxc.ArrowFunctionExpression;
      const base = instanceScope(this.plan, declaration.scope);
      // A function that a module function gave the component calls its shared code.
      const shared = this.rewriter.sharedCall(site, '$$s', base);
      if (shared) {
        this.part = this.placement.get(declaration)!;
        this.emit(
          `${this.part === 'shared' ? 'export ' : ''}const ${declaration.name}$ = ($$s, ...$$a) => ${shared.fn}($$s, ${shared.refs}, ...$$a);`,
        );
        continue;
      }
      const code = this.rewriter.rewrite(site, '$$s', base, {
        edit: (patch) => {
          if (fn.type === 'FunctionDeclaration' && fn.id) {
            patch.replace(fn.id.start, fn.id.end, `${declaration.name}$`);
          }
          const first = fn.params[0];
          if (first) {
            // An arrow such as `(n) => n` starts at its parenthesis.
            const parenthesized = this.file.source.lastIndexOf('(', first.start) >= fn.start;
            patch.insert(first.start, parenthesized ? '$$s, ' : '($$s, ');
            if (!parenthesized) {
              patch.insert(first.end, ')');
            }
          } else {
            const open = this.file.source.indexOf(
              '(',
              fn.type === 'FunctionDeclaration' && fn.id ? fn.id.end : fn.start,
            );
            patch.insert(open + 1, '$$s');
          }
        },
      });
      this.part = this.placement.get(declaration)!;
      const prefix = this.part === 'shared' ? 'export ' : '';
      this.emit(
        fn.type === 'FunctionDeclaration'
          ? `${prefix}${code}`
          : `${prefix}const ${declaration.name}$ = ${code};`,
      );
    }
  }

  private emitRoots(): void {
    for (const site of this.model.sites) {
      const symbol = this.plan.symbols.get(site);
      if (!symbol) {
        continue;
      }
      const base = instanceScope(this.plan, site.scope);
      // A template passed as a prop, such as `item=option`, renders in the browser with its code.
      let code = this.withTemplates(site, this.rewriter.rewrite(site, '$$s', base));
      // A method of a provided object, such as `reset() {}`, has no `function` keyword of its own.
      if (site.node.type === 'FunctionExpression' && unmarked(code).trimStart().startsWith('(')) {
        code = `function ${code}`;
      }
      this.part = symbol;
      if (symbol.startsWith('t')) {
        this.emitTemplateArgs(site, symbol);
      }
      if (site.kind === 'client') {
        this.emit(
          `export function ${symbol}($$s) {\n  $$b.effect($$s, ${JSON.stringify(symbol)}, ${code});\n}`,
        );
      } else {
        this.emit(this.handlerExport(site, symbol, code, base));
      }
    }
  }

  /**
   * The export of a handler, which the core calls with the scope and the
   * arguments. A local function already takes them, so it is exported as it
   * is. An arrow function gets the scope as its first parameter.
   */
  private handlerExport(site: Site, symbol: string, code: string, base: Scope): string {
    const node = site.node;
    const fn =
      node.type === 'Identifier'
        ? site.reads.find((read) => read.range.start === node.start)?.declaration
        : undefined;
    if (fn?.kind === 'function' && slotIndex(this.plan, fn) === -1) {
      const owner = scopePath(this.plan, '$$s', base, instanceScope(this.plan, fn.scope));
      if (owner === '$$s') {
        return `export { ${fn.name}$ as ${symbol} };`;
      }
      return `export const ${symbol} = ($$s, ...$$a) => ${fn.name}$(${owner}, ...$$a);`;
    }
    if (node.type === 'ArrowFunctionExpression' && !this.rewriter.sharedCall(site, '$$s', base)) {
      const arrow = this.rewriter.rewrite(site, '$$s', base, {
        edit: (patch) => {
          const first = node.params[0];
          if (first) {
            // An arrow such as `(n) => n` starts at its parenthesis, after `async` if it has it.
            const parenthesized = this.file.source.lastIndexOf('(', first.start) >= node.start;
            patch.insert(first.start, parenthesized ? '$$s, ' : '($$s, ');
            if (!parenthesized) {
              patch.insert(first.end, ')');
            }
          } else {
            patch.insert(this.file.source.indexOf('(', node.start) + 1, '$$s');
          }
        },
      });
      return `export const ${symbol} = ${arrow};`;
    }
    return `export const ${symbol} = ($$s, ...$$a) => (${code})(...$$a);`;
  }

  // Updates

  private emitUpdates(): void {
    const blocks = new Map<Block, string>();
    for (const node of this.plan.graph.nodes) {
      if (node.kind === 'source' || !this.plan.graph.live.has(node)) {
        continue;
      }
      const site = node.site;
      const base = instanceScope(this.plan, site.scope);
      const expression = (): string =>
        this.withTemplates(site, this.rewriter.rewrite(site, '$$s', base));
      // A literal class value, as the code of its text. A template call needs the code around it.
      const classes = (value: oxc.Node): string | undefined => {
        if ([...site.calls].some((callee) => callee.kind === 'template')) {
          return undefined;
        }
        const parts = this.rewriter.rewriteRanges(site, '$$s', base, (slice) =>
          literalClasses(value, slice),
        );
        return parts && classText(parts);
      };
      const name = (prefix: string): string => {
        const value = `${prefix}${site.id}`;
        this.updates.set(node, value);
        return value;
      };
      switch (node.kind) {
        case 'memo': {
          const slot = slotIndex(this.plan, node.declaration);
          if (slot !== -1) {
            // A promise is loaded with the old value kept until it settles. `await` needs an async function.
            const code = site.awaits ? `(async () => (${expression()}))()` : expression();
            // An object literal needs parentheses, or the arrow reads it as a block.
            const value = site.node.type === 'ObjectExpression' ? `(${code})` : code;
            const timing = node.declaration.timing;
            // A debounced or throttled memo computes after its wait, with the values of then.
            const call = timing
              ? `$$b.timed($$s, ${slot}, ${timing.ms}, ${timing.kind === 'throttled'}, () => ${value})`
              : `$$b.memo($$s, ${slot}, () => ${value})`;
            this.emit(`export function ${name('m')}($$s) {\n  ${call};\n}`);
          }
          break;
        }
        case 'effect':
          this.emit(
            `export function ${name('e')}($$s) {\n  $$b.effect($$s, ${JSON.stringify(`e${site.id}`)}, ${expression()});\n}`,
          );
          break;
        case 'binding':
          this.emitBinding(node, site, expression, name, classes);
          break;
        case 'block': {
          if (site.label === 'for key') {
            break;
          }
          const existing = blocks.get(node.block);
          if (existing) {
            this.updates.set(node, existing);
            break;
          }
          const fn = name('b');
          blocks.set(node.block, fn);
          this.emitBlockUpdate(node.block, fn, base);
          break;
        }
      }
    }
  }

  private emitBinding(
    node: GraphNode,
    site: Site,
    expression: () => string,
    name: (prefix: string) => string,
    classes: (node: oxc.Node) => string | undefined,
  ): void {
    const owner = site.owner;
    if (site.kind === 'insert') {
      const insert = this.findInsert(site);
      const anchor = insert && this.plan.anchors.get(insert);
      if (anchor !== undefined) {
        let fn = 'text';
        if (this.plan.textContents.has(insert!)) {
          fn = 'writeText';
        } else if (this.plan.contents.has(insert!)) {
          fn = 'content';
        }
        this.emit(
          `export function ${name('u')}($$s) {\n  $$b.${fn}($$s, ${anchor}, ${expression()});\n}`,
        );
      }
      return;
    }
    if (site.kind === 'title') {
      this.emit(`export function ${name('u')}($$s) {\n  $$b.title(${expression()});\n}`);
      return;
    }
    if (site.kind === 'provide') {
      const context = site.extra![0]!;
      this.emit(
        `export function ${name('u')}($$s) {\n  $$b.updateContext($$s, ${copy(this.file.source, context.start, context.end)}, ${expression()});\n}`,
      );
      return;
    }
    if (site.kind === 'style') {
      const variable = this.plan.styles.variables.find((item) => item.expression.ast === site.node);
      if (variable) {
        this.emit(
          `export function ${name('u')}($$s) {\n  $$b.setVar($$s, ${JSON.stringify(variable.name)}, ${variableValue(variable, expression())});\n}`,
        );
      }
      return;
    }
    // The `#key` block around a dynamic tag renders it again when the tag changes.
    if (!owner || owner.kind === 'listener' || site.kind === 'tag') {
      return;
    }
    const anchor = this.plan.anchors.get(owner);
    if (anchor === undefined) {
      return;
    }
    const attribute = owner.attributes.find(
      (item) =>
        (item.kind === 'value' && item.value.ast === site.node) ||
        (item.kind === 'event' && item.handler.ast === site.node) ||
        (item.kind === 'spread' && item.value.ast === site.node) ||
        (item.kind === 'computed' &&
          (item.name.ast === site.node || (item.value !== true && item.value.ast === site.node))),
    );
    if (
      !attribute ||
      attribute.kind === 'static' ||
      attribute.kind === 'ref' ||
      (attribute.kind === 'computed' && owner.kind === 'component')
    ) {
      this.error('This attribute cannot change on the client yet', site.range);
      return;
    }
    if (owner.kind === 'component') {
      if (attribute.kind === 'spread') {
        // The props after the spread win over it, as on the server.
        const after = owner.attributes
          .slice(owner.attributes.indexOf(attribute) + 1)
          .flatMap((item) =>
            item.kind === 'static' || item.kind === 'value' || item.kind === 'event'
              ? [item.name]
              : [],
          );
        this.emit(
          `export function ${name('u')}($$s) {\n  $$b.spreadProps($$s, ${anchor}, ${expression()}, ${JSON.stringify(after)});\n}`,
        );
        return;
      }
      this.emit(
        `export function ${name('u')}($$s) {\n  $$b.prop($$s, ${anchor}, ${JSON.stringify(attribute.name)}, ${expression()});\n}`,
      );
      return;
    }
    if (attribute.kind === 'spread' || attribute.kind === 'computed') {
      // The attributes that are the element's own, which the spread does not remove.
      const own = owner.attributes.flatMap((item) =>
        item.kind === 'static' || item.kind === 'value' ? [item.name] : [],
      );
      // The scope attribute is the element's own. Its style is not: a spread can write one, and
      // an update writes the style variables again with whatever style the spread passes on.
      if (this.plan.styles.css) {
        own.push(this.plan.styles.attribute);
      }
      // The other spreads of the element, which an update writes too. Each update tracks the
      // attributes that it wrote, so an update of one spread alone would remove the others'.
      const spreads = this.spreadCode(owner, attribute);
      // A computed attribute whose name or value has no code in the browser would drop out of the
      // update, and the attribute with it.
      for (const item of owner.attributes) {
        if (item.kind !== 'computed') {
          continue;
        }
        const code =
          item === attribute ? this.computedCode(item, site) : spreads.get(item.name.ast);
        if (code === undefined) {
          this.error('This attribute cannot change on the client yet', site.range);
          return;
        }
      }
      // The element's static attributes merge with the spreads in their order, as on the server.
      const parts = owner.attributes.flatMap((item) => {
        if (item === attribute) {
          const code = item.kind === 'computed' ? this.computedCode(item, site) : expression();
          return code ? [code] : [];
        }
        if (item.kind === 'spread' || item.kind === 'computed') {
          const code = spreads.get(item.kind === 'spread' ? item.value.ast : item.name.ast);
          return code ? [code] : [];
        }
        return item.kind === 'static'
          ? [
              `{ ${JSON.stringify(item.name)}: ${item.value === true ? "''" : JSON.stringify(decodeAttribute(item.value))} }`,
            ]
          : [];
      });
      // The handlers of a dynamic tag name their scope, as in its first render, so the update
      // knows them from the entries of the spreads.
      const events = owner.kind === 'dynamic' ? this.ownEvents(owner) : [];
      if (events.length > 0) {
        parts.push(`{ "b-on": $$b.internal(${events.join(' + " " + ')}) }`);
      }
      const value =
        parts.length > 1 ? `$$b.mergeAttributes([${parts.join(', ')}])` : (parts[0] ?? '{}');
      this.emit(
        `export function ${name('u')}($$s) {\n  $$b.attrs($$s, ${anchor}, ${value}, ${JSON.stringify(own)});\n}`,
      );
    } else if (attribute.kind === 'value') {
      let value =
        (attribute.name === 'class' ? classes(attribute.value.ast) : undefined) ?? expression();
      // A class adds to the classes of the spreads of the element, as on the server, so an update
      // of the element's own class keeps theirs.
      if (attribute.name === 'class') {
        const spreads = [...this.spreadCode(owner).values()];
        if (spreads.length > 0) {
          value = `[${[value, ...spreads.map((code) => `(${code})?.class`)].join(', ')}]`;
        }
      }
      this.emit(
        `export function ${name('u')}($$s) {\n  $$b.attr($$s, ${anchor}, ${JSON.stringify(attribute.name)}, ${value});\n}`,
      );
    }
    void node;
  }

  /** The `b-on` entries of the handlers of a dynamic tag, each as code that adds the scope ID. */
  private ownEvents(node: DynamicTagNode): string[] {
    const entries: string[] = [];
    for (const attribute of node.attributes) {
      const site =
        attribute.kind === 'event'
          ? this.model.sites.find((item) => item.node === attribute.handler.ast)
          : undefined;
      if (attribute.kind === 'event' && site) {
        const all = [...new Set([...attribute.modifiers, ...(site.modifiers ?? [])])];
        const entry = `${[attribute.event, ...all].join(':')}=${this.plan.id}#${this.plan.symbols.get(site)}@`;
        entries.push(`${JSON.stringify(entry)} + $$s.id`);
      }
    }
    return entries;
  }

  /**
   * The code of the spreads of an element, by their node, without `except`. A spread that
   * cannot change has code in the browser when each value that it reads has a slot, such as a
   * rest prop that markup of the browser reads.
   */
  private spreadCode(
    owner: { attributes: Attribute[] },
    except?: Attribute,
  ): Map<oxc.Node, string> {
    const spreads = new Map<oxc.Node, string>();
    for (const item of owner.attributes) {
      if (item === except) {
        continue;
      }
      if (item.kind === 'spread') {
        const code = this.valueCode(item.value.ast);
        if (code !== undefined) {
          spreads.set(item.value.ast, code);
        }
      } else if (item.kind === 'computed') {
        const code = this.computedCode(item);
        if (code !== undefined) {
          spreads.set(item.name.ast, code);
        }
      }
    }
    return spreads;
  }

  /** The code of a computed attribute, as an object, when the code of its name and value is known. */
  private computedCode(item: Attribute & { kind: 'computed' }, site?: Site): string | undefined {
    const part = (ast: oxc.Node): string | undefined =>
      site?.node === ast ? this.rewrittenCode(site) : this.valueCode(ast);
    const name = part(item.name.ast);
    const value = item.value === true ? 'true' : part(item.value.ast);
    return name === undefined || value === undefined ? undefined : `{ [${name}]: ${value} }`;
  }

  /** The code of an expression of the browser, or undefined when it has no code there. */
  private valueCode(ast: oxc.Node): string | undefined {
    const other = this.plan.graph.nodes.find(
      (candidate) =>
        candidate.kind !== 'source' &&
        candidate.site.node === ast &&
        (this.plan.graph.live.has(candidate) ||
          candidate.site.reads.every((read) => slotIndex(this.plan, read.declaration) !== -1)),
    );
    return other && other.kind !== 'source' ? this.rewrittenCode(other.site) : undefined;
  }

  private rewrittenCode(site: Site): string {
    return this.withTemplates(
      site,
      this.rewriter.rewrite(site, '$$s', instanceScope(this.plan, site.scope)),
    );
  }

  private findInsert(site: Site): Markup | undefined {
    for (const target of this.plan.anchors.keys()) {
      if (
        'expression' in target &&
        target.kind === 'insert' &&
        target.expression.ast === site.node
      ) {
        return target;
      }
    }
    return undefined;
  }

  private headerSites(block: Block): Site[] {
    return this.model.sites.filter(
      (site) => site.kind === 'block' && site.block === block && site.label !== 'for key',
    );
  }

  /** The scope IDs inside the bodies of a block, for disposing their instances. */
  private kinds(bodies: Body[]): number[] {
    const result: number[] = [];
    for (const body of bodies) {
      const scope = this.plan.bodyScopes.get(body)!;
      for (const item of this.model.scopes) {
        if (isWithin(item, scope)) {
          result.push(item.id);
        }
      }
    }
    return result;
  }

  /** The windowed lists whose `w` export is emitted. */
  private readonly windowStarts = new Set<Block>();

  /**
   * The `w` export of each windowed list whose header does not change, which has no update. It
   * starts the window, which renders the items in view.
   */
  private emitWindowStarts(): void {
    for (const block of this.windowedBlocks()) {
      if (this.windowStarts.has(block)) {
        continue;
      }
      const site = this.headerSites(block)[0];
      if (!site) {
        continue;
      }
      this.emitBlockUpdate(
        block,
        `b${this.counterOfWindows++}w`,
        instanceScope(this.plan, site.scope),
      );
    }
  }

  private counterOfWindows = 0;

  private windowedBlocks(): Block[] {
    const found: Block[] = [];
    const visit = (nodes: readonly unknown[]): void => {
      for (const node of nodes as { kind?: string }[]) {
        if (!node || typeof node !== 'object') {
          continue;
        }
        const block = node as Block;
        if (block.kind === 'for' && block.window) {
          found.push(block);
        }
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) {
            visit(value);
          } else if (value && typeof value === 'object' && 'children' in (value as object)) {
            visit((value as { children: unknown[] }).children);
          }
        }
      }
    };
    visit(this.file.children);
    for (const template of this.file.templates) {
      visit(template.body.children);
    }
    return found;
  }

  private renderName(body: Body): string {
    return `r${this.plan.bodyScopes.get(body)!.id}`;
  }

  private emitBlockUpdate(block: Block, fn: string, base: Scope): void {
    const anchor = this.plan.anchors.get(block);
    if (anchor === undefined) {
      return;
    }
    const held = holderArguments(this.plan, block);
    const headers = this.headerSites(block);
    const header = (index: number): string => this.rewriter.rewrite(headers[index]!, '$$s', base);
    switch (block.kind) {
      case 'if':
      case 'switch': {
        const branches = block.kind === 'if' ? block.branches : block.cases;
        const bodies = branches.map((branch) => branch.body);
        let index = block.fallback ? String(branches.length) : '-1';
        for (let i = branches.length - 1; i >= 0; i--) {
          index = `(${header(i)}) ? ${i} : ${index}`;
        }
        const renders = [...bodies, ...(block.fallback ? [block.fallback] : [])].map((body) =>
          this.renderName(body),
        );
        this.emit(
          `export function ${fn}($$s) {\n  $$b.branch($$s, ${anchor}, ${index}, ${this.hoist(`[${renders.join(', ')}]`)}, ${this.hoist(`[${this.kinds(blockBodies(block)).join(', ')}]`)}${held});\n}`,
        );
        return;
      }
      case 'for':
      case 'repeat': {
        const items =
          block.kind === 'for'
            ? `$$b.listOf(${header(0)})`
            : `Array.from({ length: ${header(0)} }, (_, index) => index)`;
        const key = this.keyFunction(block, base);
        // A key that reads only the item is the same function for every update.
        const keyName = key.includes('$$s') ? key : this.hoist(key);
        const fallback = block.fallback ? this.renderName(block.fallback) : 'undefined';
        const fallbackKinds = block.fallback ? this.kinds([block.fallback]) : [];
        const kinds = this.hoist(`[${fallbackKinds.join(', ')}]`);
        const render = this.renderName(block.body);
        const assign = `a${this.plan.bodyScopes.get(block.body)!.id}`;
        // A windowed list renders the items in view, and its `w` export starts its window.
        const call =
          block.kind === 'for' && block.window
            ? `$$b.windowList($$s, ${anchor}, ${items}, ${keyName}, ${render}, ${assign}, ${fallback}, ${kinds}, ${header(1)}${held})`
            : `$$b.list($$s, ${anchor}, ${items}, ${keyName}, ${render}, ${assign}, ${fallback}, ${kinds}${held})`;
        this.emit([`export function ${fn}($$s) {`, `  ${call};`, '}'].join('\n'));
        if (block.kind === 'for' && block.window) {
          this.emit(
            `export function w${anchor}($$s) {\n  $$b.windowStart($$s, ${anchor}, () => ${call});\n}`,
          );
          this.windowStarts.add(block);
        }
        this.emitAssign(block);
        return;
      }
      case 'portal': {
        if (!block.target) {
          return;
        }
        // A new target moves the body: the old one is removed and the body renders into the new one.
        const body = this.plan.bodyScopes.get(block.body)!;
        this.emit(
          `export function ${fn}($$s) {\n  $$b.portalTo($$s, ${header(0)}, r${body.id}, [${body.id}]${held});\n}`,
        );
        return;
      }
      case 'offscreen':
        this.emit(
          `export function ${fn}($$s) {\n  $$b.offscreen($$s, ${anchor}, ${header(0)}, ${this.renderName(block.body)}, ${this.plan.bodyScopes.get(block.body)!.id}${held});\n}`,
        );
        return;
      case 'key': {
        // The block around a dynamic tag keeps the element that the server rendered with the tag.
        const [inner] = block.body.children;
        const helper = inner?.kind === 'dynamic' && inner.keyed ? 'retag' : 'rekey';
        this.emit(
          `export function ${fn}($$s) {\n  $$b.${helper}($$s, ${anchor}, ${header(0)}, ${this.renderName(block.body)}, ${this.hoist(`[${this.kinds([block.body]).join(', ')}]`)}${held});\n}`,
        );
        return;
      }
      default:
        return;
    }
  }

  private itemDeclarations(block: ForBlock | RepeatBlock): Declaration[] {
    return this.model.declarations.filter(
      (declaration) =>
        declaration.block === block &&
        (declaration.kind === 'item' || declaration.kind === 'index'),
    );
  }

  private keyFunction(block: ForBlock | RepeatBlock, base: Scope): string {
    if (block.kind === 'repeat' || block.key === 'index') {
      return '($$item, $$index) => $$index';
    }
    if (!block.key) {
      return '($$item) => $$item';
    }
    const site = this.model.sites.find((item) => item.label === 'for key' && item.block === block)!;
    const locals = new Set(this.itemDeclarations(block));
    const key = this.rewriter.rewrite(site, '$$s', base, { locals });
    const pattern = copy(this.file.source, block.item.start, block.item.end);
    const index = block.index ? ` const ${block.index.name} = $$index;` : '';
    return `($$item, $$index) => { const ${pattern} = $$item;${index} return ${key}; }`;
  }

  /** Emits the function that writes a new item and index into an item's scope. */
  private emitAssign(block: ForBlock | RepeatBlock): void {
    const scope = this.plan.bodyScopes.get(block.body)!;
    const lines = [`export function a${scope.id}($$s, $$item, $$index) {`, '  $$s.i = $$item;'];
    if (block.kind === 'for') {
      lines.push(`  const ${copy(this.file.source, block.item.start, block.item.end)} = $$item;`);
    }
    for (const declaration of this.itemDeclarations(block)) {
      const slot = slotIndex(this.plan, declaration);
      if (slot !== -1) {
        const value = declaration.kind === 'index' ? '$$index' : declaration.name;
        lines.push(`  $$b.set($$s, ${slot}, ${value});`);
      }
    }
    lines.push('}');
    this.emit(lines.join('\n'));
  }

  // Render functions

  private collectRenders(): void {
    for (const node of this.plan.graph.nodes) {
      if (
        node.kind !== 'block' ||
        !this.plan.graph.live.has(node) ||
        node.site.label === 'for key'
      ) {
        continue;
      }
      if (!['if', 'switch', 'for', 'repeat', 'key', 'offscreen'].includes(node.block.kind)) {
        continue;
      }
      for (const body of blockBodies(node.block)) {
        this.renders.set(this.plan.bodyScopes.get(body)!, { body, block: node.block });
      }
    }
    for (const scope of this.model.scopes) {
      const block = scope.block;
      const clientOnly =
        (block?.kind === 'client' && scope.body === block.body) ||
        (block?.kind === 'portal' && block.target !== undefined) ||
        // The browser renders the items of a windowed list that come into view.
        (block?.kind === 'for' && block.window !== undefined) ||
        (block?.kind === 'try' && this.plan.anchors.has(block));
      if (scope.kind === 'body' && block && clientOnly && scope.body) {
        this.renders.set(scope, { body: scope.body, block });
      }
    }
  }

  /**
   * Replaces the one `$$html +=` line of a render with a clone of a template and the writes on
   * its elements. Returns false when the markup needs HTML.
   */
  private cloneRender(emitter: Emitter): boolean {
    return cloneLines(emitter, (code) => this.hoist(code));
  }

  /**
   * The code of the render function of a body. With `fill`, the body fills its nested blocks
   * after it clones its template, and gives undefined when it cannot clone.
   */
  private emitRender(scope: Scope, body: Body, block: Block, fill: boolean): string | undefined {
    const base = scope.parent!;
    const inside = this.inside(scope);
    const emitter = new Emitter(this.file, this.plan, this.valuePatch, {
      mode: 'client',
      outer: { inside, base, baseVar: '$$p' },
      fills: fill ? (nested) => this.fillOf(nested) : undefined,
      hoist: (code) => this.hoist(code),
    });
    const isItem = (block.kind === 'for' || block.kind === 'repeat') && block.body === body;
    const isCatch = block.kind === 'try' && block.fallback === body;
    let params = '';
    if (isItem) {
      params = ', $$item, $$index';
    } else if (isCatch) {
      params = ', $$error';
    }
    emitter.line(`export function r${scope.id}($$p${params}) {`);
    emitter.line(`let $$html = '';`);
    if (block.kind === 'try' && isCatch) {
      if (block.error) {
        emitter.line(`const ${block.error.name} = $$error;`);
      }
      if (block.reset) {
        emitter.line(`const ${block.reset.name} = undefined;`);
      }
    }
    for (const line of this.prologue(inside, base)) {
      emitter.line(line);
    }
    for (const template of this.declared(inside).slice(1)) {
      emitter.emitTemplate(template.template!);
    }
    if (isItem) {
      emitter.emitItem(block, '$$item', '$$index');
    } else {
      emitter.emitBody(body);
    }
    emitter.flush();
    // The body of an `#if` or a `#for` whose markup is one string clones a template.
    const cloned = block.kind === 'if' || block.kind === 'for' ? this.cloneRender(emitter) : false;
    if (fill && !cloned) {
      return undefined;
    }
    emitter.line(emitter.returnLine(0, cloned));
    emitter.close();
    return emitter.lines.join('\n');
  }

  /** The name of the render function of a body, when the module has one. */
  private renderOf(body: object | undefined): string | undefined {
    const scope = body && this.plan.bodyScopes.get(body as never);
    return scope && this.renders.has(scope) ? `r${scope.id}` : undefined;
  }

  /**
   * The render functions that fill a nested `#if` or `#for` of a clone, when the module has
   * them all. A `#for` with an `#else` renders inline.
   */
  private fillOf(block: Block): Fill | undefined {
    if (block.kind === 'if') {
      const bodies = [...block.branches.map((branch) => branch.body), block.fallback].filter(
        (body) => body !== undefined,
      );
      const renders = bodies.map((body) => this.renderOf(body));
      return renders.every((name) => name !== undefined)
        ? { kind: 'if', renders: renders as string[] }
        : undefined;
    }
    if (block.kind === 'for' && !block.fallback) {
      const render = this.renderOf(block.body);
      return render ? { kind: 'for', render } : undefined;
    }
    return undefined;
  }

  private emitRenders(): void {
    for (const [scope, { body, block }] of this.renders) {
      const clonable = block.kind === 'if' || block.kind === 'for';
      // A body that fills its nested blocks must clone, so one that cannot renders again inline.
      const lines =
        (clonable && this.emitRender(scope, body, block, true)) ||
        this.emitRender(scope, body, block, false)!;
      this.emit(lines);
      const base = scope.parent!;

      if (block.kind === 'portal' && block.target) {
        const header = this.model.sites.find(
          (site) => site.kind === 'block' && site.block === block,
        )!;
        const target = this.rewriter.rewrite(header, '$$s', instanceScope(this.plan, base));
        const held = holderArguments(this.plan, block);
        this.emit(
          `export function k${scope.id}($$s) {\n  $$b.portalTo($$s, ${target}, r${scope.id}${held && `, []${held}`});\n}`,
        );
      }
      if (block.kind === 'client') {
        const anchor = this.plan.anchors.get(block)!;
        // The fallback's scopes go when the body renders in its place.
        const held = holderArguments(this.plan, block);
        const kinds = block.fallback
          ? this.hoist(`[${this.kinds([block.fallback]).join(', ')}]`)
          : '[]';
        const fallback = block.fallback || held ? `, ${kinds}${held}` : '';
        this.emit(
          `export function k${scope.id}($$s) {\n  $$b.fill($$s, ${anchor}, r${scope.id}${fallback});\n}`,
        );
      }
    }
  }

  /**
   * The renders of children, such as `n0`, which the browser calls each time a component inserts
   * them again, so they get new scopes, as the body of a block does.
   */
  private emitChildrenRenders(): void {
    for (const [node, { symbol, scope }] of this.plan.childrenRenders) {
      const range = { start: node.children[0]!.start, end: node.children.at(-1)!.end };
      const within = (item: { start: number; end: number } | undefined): boolean =>
        item !== undefined && range.start <= item.start && item.end <= range.end;
      // The scopes of the blocks in the children, and of the templates that the children call.
      const nested = this.model.scopes.filter(
        (item) => item.parent === scope && item.kind === 'body' && within(item.block),
      );
      for (const site of this.model.sites) {
        if (site.scope !== scope || !within(site.node as { start: number; end: number })) {
          continue;
        }
        // The templates that the children call, and those that they pass on, such as a prop
        // `render=label`.
        const used = [...site.calls, ...site.reads.map((read) => read.declaration)];
        for (const callee of used) {
          const template =
            callee.kind === 'template'
              ? this.model.scopes.find(
                  (item) => item.template?.name === callee.name && item.parent === callee.scope,
                )
              : undefined;
          if (template && !nested.includes(template)) {
            nested.push(template);
          }
        }
      }
      const inside = [...new Set(nested.flatMap((item) => this.inside(item)))];
      const base = instanceScope(this.plan, scope);
      const emitter = new Emitter(this.file, this.plan, this.valuePatch, {
        mode: 'client',
        outer: { inside, base, baseVar: '$$p' },
        hoist: (code) => this.hoist(code),
      });
      emitter.line(`export function ${symbol}($$p) {`);
      emitter.line(`let $$html = '';`);
      for (const line of this.prologue(inside, base)) {
        emitter.line(line);
      }
      // The values that the children read in the scope that they were written in.
      const declarations = new Set<Declaration>();
      for (const site of this.model.sites) {
        if (site.scope === scope && within(site.node as { start: number; end: number })) {
          for (const read of site.reads) {
            if (!inside.some((item) => isWithin(read.declaration.scope, item))) {
              declarations.add(read.declaration);
            }
          }
        }
      }
      for (const declaration of declarations) {
        if (['import', 'module', 'template'].includes(declaration.kind)) {
          continue;
        }
        const value = this.rewriter.value(declaration, '$$p', base);
        if (
          value &&
          !emitter.lines.some((line) => line.trim().startsWith(`let ${declaration.name} =`))
        ) {
          emitter.line(`let ${declaration.name} = ${value};`);
        }
      }
      for (const template of this.declared(inside).filter((item) => item.kind === 'template')) {
        emitter.emitTemplate(template.template!);
      }
      emitter.emitChildrenBody(node, scope);
      emitter.flush();
      const cloned = cloneLines(emitter, (code) => this.hoist(code));
      emitter.line(emitter.returnLine(0, cloned));
      emitter.close();
      this.emit(emitter.lines.join('\n'));
    }
  }

  /**
   * Code that calls `#template`s, such as an insert of `{price(total)}` that
   * updates. The render module defines templates inside the component's
   * render function, so an update defines the ones that it calls itself.
   */
  /**
   * The slots of the arguments of a template that a prop passes, as `[slot, value]` pairs, so an
   * insert that calls it again writes its new arguments into the scope that it rendered.
   */
  private emitTemplateArgs(site: Site, symbol: string): void {
    const callee = site.reads
      .map((read) => read.declaration)
      .find((item) => item.kind === 'template');
    const scope =
      callee &&
      this.model.scopes.find(
        (item) => item.template?.name === callee.name && item.parent === callee.scope,
      );
    const template = scope?.template;
    if (!scope || !template) {
      return;
    }
    const first = template.params[0];
    const last = template.params.at(-1);
    const params = first && last ? copy(this.file.source, first.start, last.end) : '';
    const slots = [...scope.declarations.values()]
      .filter((declaration) => declaration.kind === 'template-param')
      .map((declaration) => [slotIndex(this.plan, declaration), declaration.name] as const);
    // An argument without a slot is not in the scope, so the template renders again instead.
    if (slots.some(([slot]) => slot === -1)) {
      return;
    }
    const pairs = slots.map(([slot, name]) => `[${slot}, ${name}]`);
    this.emit(`export const ${symbol}a = (${params}) => [${pairs.join(', ')}];`);
    // The ID of the template's scope, so an insert updates in place only a scope of this template.
    this.emit(`export const ${symbol}k = ${scope.id};`);
  }

  private withTemplates(site: Site, code: string): string {
    const templates: Scope[] = [];
    // The templates that the code calls, and those that it passes on, such as a prop `item=option`.
    const used = [
      ...site.calls,
      ...site.reads.map((read) => read.declaration).filter((item) => item.kind === 'template'),
    ];
    for (const callee of used) {
      if (callee.kind !== 'template') {
        continue;
      }
      const template = this.model.scopes.find(
        (item) => item.template?.name === callee.name && item.parent === callee.scope,
      );
      for (const item of template ? this.inside(template) : []) {
        if (!templates.includes(item)) {
          templates.push(item);
        }
      }
    }
    if (templates.length === 0) {
      return code;
    }
    const base = templates[0]!.parent!;
    const emitter = new Emitter(this.file, this.plan, this.valuePatch, {
      mode: 'client',
      outer: { inside: templates, base, baseVar: '$$p' },
    });
    for (const line of this.prologue(templates, base)) {
      emitter.line(line);
    }
    for (const template of this.declared(templates)) {
      emitter.emitTemplate(template.template!);
    }
    emitter.flush();
    const parent = scopePath(this.plan, '$$s', site.scope, base);
    return `(($$p) => {\n${emitter.lines.join('\n')}\nreturn ${code};\n})(${parent})`;
  }

  /** Declares the outer values that a render function reads, as local variables. */
  private prologue(inside: Scope[], base: Scope): string[] {
    const isInside = (scope: Scope): boolean => inside.some((item) => isWithin(scope, item));
    const declarations = new Set<Declaration>();
    for (const site of this.model.sites) {
      // Top-level elements of a body render the style variables of the component.
      const rendered = isInside(site.scope) || site.kind === 'style';
      if (!rendered || DEFERRED_SITES.has(site.kind)) {
        continue;
      }
      for (const read of site.reads) {
        if (!isInside(read.declaration.scope)) {
          declarations.add(read.declaration);
        }
      }
    }
    const lines: string[] = [];
    for (const declaration of declarations) {
      if (
        declaration.kind === 'import' ||
        declaration.kind === 'module' ||
        declaration.kind === 'template'
      ) {
        continue;
      }
      const value = this.rewriter.value(declaration, '$$p', base);
      if (value) {
        // `let`, because inline function props in the markup can assign to it. They never run here.
        lines.push(`let ${declaration.name} = ${value};`);
      }
    }
    return lines;
  }

  // Dependency table

  /**
   * The memos to load again when a server function calls `refresh(fn)`:
   * by the ID of `fn`, the scope kind and the update of each memo.
   */
  /**
   * The `#try` blocks that catch errors of client code, by the scope kinds
   * inside their bodies: the kind of the scope that holds the block, the
   * anchor of the block, the render functions of the body and the `#catch`
   * body, and the kinds of both bodies, and the holder of a block in children.
   */
  private triesTable(): string | undefined {
    const entries: string[] = [];
    for (const scope of this.model.scopes) {
      const block = scope.block;
      if (
        block?.kind !== 'try' ||
        scope.body !== block.body ||
        !this.plan.anchors.has(block) ||
        !tryCatchesClient(this.model, block)
      ) {
        continue;
      }
      const owner = instanceScope(this.plan, scope.parent!);
      const fallback = this.plan.bodyScopes.get(block.fallback)!;
      const held = holderArguments(this.plan, block);
      const entry = `[${owner.id}, ${this.plan.anchors.get(block)}, ${JSON.stringify(`r${scope.id}`)}, ${JSON.stringify(`r${fallback.id}`)}, [${this.kinds(blockBodies(block)).join(', ')}]${held}]`;
      for (const inside of this.model.scopes) {
        if (isWithin(inside, scope)) {
          entries.push(`${inside.id}: ${entry}`);
        }
      }
    }
    return entries.length > 0 ? `{ ${entries.join(', ')} }` : undefined;
  }

  private refreshTable(): string | undefined {
    const table = new Map<string, [number, string][]>();
    for (const node of this.plan.graph.nodes) {
      if (node.kind !== 'memo') {
        continue;
      }
      const fn = this.updates.get(node);
      if (!fn) {
        continue;
      }
      for (const callee of node.site.calls) {
        if (callee.serverImport || (callee.kind === 'server-function' && callee.refreshed)) {
          const id = callee.serverImport ?? serverFunctionId(this.plan, callee.name);
          const entries = table.get(id) ?? [];
          entries.push([instanceScope(this.plan, node.declaration.scope).id, fn]);
          table.set(id, entries);
        }
      }
    }
    if (table.size === 0) {
      return undefined;
    }
    const items = [...table].map(
      ([id, entries]) =>
        `${JSON.stringify(id)}: [${entries.map(([kind, fn]) => `[${kind}, ${JSON.stringify(fn)}]`).join(', ')}]`,
    );
    return `{ ${items.join(', ')} }`;
  }

  private table(): string {
    const table = new Map<number, Map<number, [number, string, boolean][]>>();
    for (const edge of this.plan.graph.edges) {
      const from = edge.from;
      if (from.kind !== 'source' && from.kind !== 'memo') {
        continue;
      }
      const fn = this.updates.get(edge.to);
      if (!fn || edge.to.kind === 'source') {
        continue;
      }
      const slot = slotIndex(this.plan, from.declaration);
      if (slot === -1) {
        continue;
      }
      const kind = instanceScope(this.plan, edge.to.site.scope).id;
      const scope = from.declaration.scope.id;
      const slots = table.get(scope) ?? new Map<number, [number, string, boolean][]>();
      table.set(scope, slots);
      const entries = slots.get(slot) ?? [];
      slots.set(slot, entries);
      if (!entries.some(([, name]) => name === fn)) {
        entries.push([kind, fn, edge.to.kind === 'memo']);
      }
    }
    const scopes: string[] = [];
    for (const [scope, slots] of table) {
      const items: string[] = [];
      for (const [slot, entries] of slots) {
        // Memos update first, so bindings read their new values.
        const sorted = entries.toSorted((a, b) => Number(b[2]) - Number(a[2]));
        items.push(
          `${slot}: [${sorted.map(([kind, name]) => `[${kind}, ${JSON.stringify(name)}]`).join(', ')}]`,
        );
      }
      scopes.push(`${scope}: { ${items.join(', ')} }`);
    }
    return `{ ${scopes.join(', ')} }`;
  }
}
