import type { Block, Body, ForBlock, Markup, RepeatBlock, SFCFile } from '../ast.ts';
import type { GraphNode } from '../graph.ts';
import { isWithin } from '../model.ts';
import type { Declaration, Diagnostic, Scope, Site } from '../model.ts';
import { getPatternNames } from '../oxc.ts';
import type { oxc } from '../oxc.ts';
import { blockBodies } from '../plan.ts';
import type { Plan } from '../plan.ts';
import { Emitter } from './markup.ts';
import { Patch, addValueEdits } from './patch.ts';
import { clientModuleScript, componentNames, renderImport } from './render.ts';
import { Rewriter } from './rewrite.ts';
import { instanceScope, slotIndex } from './scopes.ts';

export interface ClientOutput {
  /** The entry module: the component ID, its props, its update table and its part loaders. */
  code: string;
  /**
   * The parts, by name. `h<n>` and `c<n>` parts hold one client root each,
   * `update` holds the code that updates the page, and `shared` holds the
   * functions that more than one part calls.
   */
  parts: Record<string, string>;
  diagnostics: Diagnostic[];
}

/** The part that holds an export of a client module. */
export function partOf(name: string): string {
  return /^[hc]\d/.test(name) ? name : 'update';
}

// Sites whose code does not run while a body renders.
const DEFERRED_SITES = new Set(['function', 'server-function', 'event', 'effect', 'client']);

export function generateClient(file: SFCFile, plan: Plan): ClientOutput {
  return new ClientGenerator(file, plan).generate();
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

  constructor(file: SFCFile, plan: Plan) {
    this.file = file;
    this.plan = plan;
    this.rewriter = new Rewriter(file, plan, this.diagnostics);
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

  generate(): ClientOutput {
    this.checkSupport();
    this.collectRenders();
    this.placeCode();

    this.emitServerStubs();
    this.emitFunctions();
    this.emitRoots();
    this.part = 'update';
    this.emitUpdates();
    this.emitRenders();

    const parts: Record<string, string> = {};
    for (const name of new Set([...this.out.keys(), ...this.reach.keys()])) {
      if (name !== 'shared') {
        parts[name] = this.assemble(name);
      }
    }
    if (this.out.has('shared') || this.usesModuleScript()) {
      parts.shared = this.assembleShared();
    }
    const loaders = Object.keys(parts)
      .filter((name) => name !== 'shared')
      .map(
        (name) =>
          `  ${JSON.stringify(name)}: () => import(${JSON.stringify(this.partPath(name))}),`,
      );
    const entry = [
      `export const id = ${JSON.stringify(this.plan.id)};`,
      `export const props = ${this.propsMap()};`,
      `export const g = ${this.table()};`,
      'const parts = {',
      ...loaders,
      '};',
      '/** Imports a part of this module. */',
      'export function load(part) {',
      '  return parts[part]();',
      '}',
      '',
    ];
    return { code: entry.join('\n'), parts, diagnostics: this.diagnostics };
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
      for (const read of site.reads) {
        result.add(read.declaration);
      }
    }
    return result;
  }

  /** The import statements for the names that some code reads. */
  private importsFor(names: Set<string>, components: boolean): string[] {
    if (components) {
      for (const scope of this.renderedScopes()) {
        componentNames(scope.body?.children ?? [], names);
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
      ...this.importsFor(names, name === 'update'),
    ];
    if (shared.length > 0) {
      lines.push(
        `import { ${[...new Set(shared)].join(', ')} } from ${JSON.stringify(this.partPath('shared'))};`,
      );
    }
    if (name === 'update') {
      lines.push('', 'const $$ctx = $$b.context;');
    }
    lines.push('', ...(this.out.get(name) ?? []), '');
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
        if (statement.type === 'ImportDeclaration') {
          lines.push(this.file.source.slice(statement.start, statement.end));
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
    lines.push('', ...(this.out.get('shared') ?? []), '');
    return lines.join('\n');
  }

  // Checks

  private checkSupport(): void {
    for (const site of this.model.sites) {
      const live = this.live.has(site);
      if (live && site.kind === 'tag') {
        this.error('A dynamic tag that changes on the client is not supported yet', site.range);
      }
      if (live && site.kind === 'memo' && site.declaration?.kind === 'async-memo') {
        this.error('An async $memo that changes on the client is not supported yet', site.range);
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
          if (template && !result.some((item) => isWithin(template, item))) {
            result.push(template);
          }
        }
      }
    }
    return result;
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
            if (property.type === 'RestElement' || property.computed) {
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

  /** Writes a stub for each server function into each part that calls it. */
  private emitServerStubs(): void {
    for (const name of [...this.reach.keys(), 'shared']) {
      this.part = name;
      for (const declaration of this.reads(this.partSites(name))) {
        if (declaration.kind === 'server-function' && declaration.scope !== this.model.module) {
          const ref = `${this.plan.id}#${declaration.name}`;
          this.emit(
            `const ${declaration.name}$ = (...$$a) => $$b.rpc(${JSON.stringify(ref)}, $$a);`,
          );
        }
      }
    }
  }

  private emitFunctions(): void {
    for (const declaration of this.model.declarations) {
      const site = declaration.site;
      if (declaration.kind !== 'function' || !site || !this.plan.clientSites.has(site)) {
        continue;
      }
      const fn = site.node as oxc.Function | oxc.ArrowFunctionExpression;
      const base = instanceScope(this.plan, declaration.scope);
      const code = this.rewriter.rewrite(site, '$$s', base, {
        edit: (patch) => {
          if (fn.type === 'FunctionDeclaration' && fn.id) {
            patch.replace(fn.id.start, fn.id.end, `${declaration.name}$`);
          }
          const first = fn.params[0];
          if (first) {
            const parenthesized = this.file.source.lastIndexOf('(', first.start) > fn.start;
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
      const code = this.rewriter.rewrite(site, '$$s', base);
      this.part = symbol;
      if (site.kind === 'client') {
        this.emit(
          `export function ${symbol}($$s) {\n  $$b.effect($$s, ${JSON.stringify(symbol)}, ${code});\n}`,
        );
      } else {
        this.emit(`export const ${symbol} = ($$s, ...$$a) => (${code})(...$$a);`);
      }
    }
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
      const expression = (): string => this.rewriter.rewrite(site, '$$s', base);
      const name = (prefix: string): string => {
        const value = `${prefix}${site.id}`;
        this.updates.set(node, value);
        return value;
      };
      switch (node.kind) {
        case 'memo': {
          const slot = slotIndex(this.plan, node.declaration);
          if (slot !== -1) {
            this.emit(
              `export function ${name('m')}($$s) {\n  $$b.set($$s, ${slot}, ${expression()});\n}`,
            );
          }
          break;
        }
        case 'effect':
          this.emit(
            `export function ${name('e')}($$s) {\n  $$b.effect($$s, ${JSON.stringify(`e${site.id}`)}, ${expression()});\n}`,
          );
          break;
        case 'binding':
          this.emitBinding(node, site, expression, name);
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
  ): void {
    const owner = site.owner;
    if (site.kind === 'insert') {
      const insert = this.findInsert(site);
      const anchor = insert && this.plan.anchors.get(insert);
      if (anchor !== undefined) {
        this.emit(
          `export function ${name('u')}($$s) {\n  $$b.text($$s, ${anchor}, ${expression()});\n}`,
        );
      }
      return;
    }
    if (site.kind === 'style') {
      const variable = this.plan.styles.variables.find((item) => item.expression.ast === site.node);
      if (variable) {
        this.emit(
          `export function ${name('u')}($$s) {\n  $$b.setVar($$s, ${JSON.stringify(variable.name)}, ${expression()});\n}`,
        );
      }
      return;
    }
    if (!owner || owner.kind === 'listener') {
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
        (item.kind === 'spread' && item.value.ast === site.node),
    );
    if (
      !attribute ||
      attribute.kind === 'static' ||
      attribute.kind === 'ref' ||
      attribute.kind === 'prefetch' ||
      attribute.kind === 'computed'
    ) {
      this.error('This attribute cannot change on the client yet', site.range);
      return;
    }
    if (owner.kind === 'component') {
      if (attribute.kind === 'spread') {
        this.error('A spread on a component cannot change on the client yet', site.range);
        return;
      }
      this.emit(
        `export function ${name('u')}($$s) {\n  $$b.prop($$s, ${anchor}, ${JSON.stringify(attribute.name)}, ${expression()});\n}`,
      );
      return;
    }
    if (attribute.kind === 'spread') {
      this.emit(
        `export function ${name('u')}($$s) {\n  $$b.attrs($$s, ${anchor}, ${expression()});\n}`,
      );
    } else if (attribute.kind === 'value') {
      this.emit(
        `export function ${name('u')}($$s) {\n  $$b.attr($$s, ${anchor}, ${JSON.stringify(attribute.name)}, ${expression()});\n}`,
      );
    }
    void node;
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

  private renderName(body: Body): string {
    return `r${this.plan.bodyScopes.get(body)!.id}`;
  }

  private emitBlockUpdate(block: Block, fn: string, base: Scope): void {
    const anchor = this.plan.anchors.get(block);
    if (anchor === undefined) {
      return;
    }
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
          `export function ${fn}($$s) {\n  $$b.branch($$s, ${anchor}, ${index}, [${renders.join(', ')}], [${this.kinds(blockBodies(block)).join(', ')}]);\n}`,
        );
        return;
      }
      case 'for':
      case 'repeat': {
        const items =
          block.kind === 'for'
            ? `Array.from(${header(0)})`
            : `Array.from({ length: ${header(0)} }, (_, index) => index)`;
        const key = this.keyFunction(block, base);
        const fallback = block.fallback ? this.renderName(block.fallback) : 'undefined';
        const fallbackKinds = block.fallback ? this.kinds([block.fallback]) : [];
        this.emit(
          [
            `export function ${fn}($$s) {`,
            `  $$b.list($$s, ${anchor}, ${items}, ${key}, ${this.renderName(block.body)}, a${this.plan.bodyScopes.get(block.body)!.id}, ${fallback}, [${fallbackKinds.join(', ')}]);`,
            '}',
          ].join('\n'),
        );
        this.emitAssign(block);
        return;
      }
      case 'key':
        this.emit(
          `export function ${fn}($$s) {\n  $$b.rekey($$s, ${anchor}, ${header(0)}, ${this.renderName(block.body)}, [${this.kinds([block.body]).join(', ')}]);\n}`,
        );
        return;
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
    const pattern = this.file.source.slice(block.item.start, block.item.end);
    const index = block.index ? ` const ${block.index.name} = $$index;` : '';
    return `($$item, $$index) => { const ${pattern} = $$item;${index} return ${key}; }`;
  }

  /** Emits the function that writes a new item and index into an item's scope. */
  private emitAssign(block: ForBlock | RepeatBlock): void {
    const scope = this.plan.bodyScopes.get(block.body)!;
    const lines = [`export function a${scope.id}($$s, $$item, $$index) {`, '  $$s.i = $$item;'];
    if (block.kind === 'for') {
      lines.push(`  const ${this.file.source.slice(block.item.start, block.item.end)} = $$item;`);
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
      if (!['if', 'switch', 'for', 'repeat', 'key'].includes(node.block.kind)) {
        continue;
      }
      for (const body of blockBodies(node.block)) {
        this.renders.set(this.plan.bodyScopes.get(body)!, { body, block: node.block });
      }
    }
    for (const scope of this.model.scopes) {
      const block = scope.block;
      const clientOnly =
        block?.kind === 'client' || (block?.kind === 'portal' && block.target !== undefined);
      if (scope.kind === 'body' && block && clientOnly && scope.body) {
        this.renders.set(scope, { body: scope.body, block });
      }
    }
  }

  private emitRenders(): void {
    for (const [scope, { body, block }] of this.renders) {
      const base = scope.parent!;
      const inside = this.inside(scope);
      const emitter = new Emitter(this.file, this.plan, this.valuePatch, {
        mode: 'client',
        outer: { inside, base, baseVar: '$$p' },
      });
      const isItem = (block.kind === 'for' || block.kind === 'repeat') && block.body === body;
      emitter.line(`export function r${scope.id}($$p${isItem ? ', $$item, $$index' : ''}) {`);
      emitter.line(`let $$html = '';`);
      for (const line of this.prologue(inside, base)) {
        emitter.line(line);
      }
      for (const template of inside.slice(1)) {
        emitter.emitTemplate(template.template!);
      }
      if (isItem) {
        emitter.emitItem(block, '$$item', '$$index');
      } else {
        emitter.emitBody(body);
      }
      emitter.flush();
      emitter.line('return $$html;');
      emitter.close();
      this.emit(emitter.lines.join('\n'));
      if (block.kind === 'portal' && block.target) {
        const header = this.model.sites.find(
          (site) => site.kind === 'block' && site.block === block,
        )!;
        if (this.live.has(header)) {
          this.error(
            'A #portal target that changes on the client is not supported yet',
            header.range,
          );
        }
        const target = this.rewriter.rewrite(header, '$$s', instanceScope(this.plan, base));
        this.emit(
          `export function k${scope.id}($$s) {\n  $$b.portal($$s, ${target}, r${scope.id});\n}`,
        );
      }
      if (block.kind === 'client') {
        const anchor = this.plan.anchors.get(block)!;
        this.emit(
          `export function k${scope.id}($$s) {\n  $$b.fill($$s, ${anchor}, r${scope.id});\n}`,
        );
      }
    }
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
