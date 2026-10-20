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
  code: string;
  diagnostics: Diagnostic[];
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
  private readonly out: string[] = [];
  private readonly live = new Map<Site, GraphNode>();
  /** The export that updates each live node. */
  private readonly updates = new Map<GraphNode, string>();
  /** Bodies that the client renders, by scope. */
  private readonly renders = new Map<Scope, { body: Body; block: Block }>();
  private readonly usedServer = new Set<Declaration>();

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
    this.out.push(code);
  }

  generate(): ClientOutput {
    this.checkSupport();
    this.collectRenders();

    this.emitServerStubs();
    this.emitFunctions();
    this.emitRoots();
    this.emitUpdates();
    this.emitRenders();

    const header = ["import * as $$b from 'brumate/client';", ...this.imports()];
    const lines = [
      ...header,
      ...this.moduleCode(),
      '',
      'const $$ctx = $$b.context;',
      '',
      `export const id = ${JSON.stringify(this.plan.id)};`,
      `export const props = ${this.propsMap()};`,
      `export const g = ${this.table()};`,
      '',
      ...this.out,
      '',
    ];
    return { code: lines.join('\n'), diagnostics: this.diagnostics };
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

  private imports(): string[] {
    const names = new Set<string>();
    for (const declaration of this.clientReads()) {
      if (declaration.kind === 'import') {
        names.add(declaration.name);
      }
    }
    // Components rendered on the client are imported from their render modules.
    for (const scope of this.renderedScopes()) {
      componentNames(scope.body?.children ?? [], names);
    }
    const includeModule = this.usesModuleScript();
    const result: string[] = [];
    const programs: oxc.Program[] = [];
    if (this.file.moduleScript) {
      programs.push(this.file.moduleScript.program);
    }
    if (this.file.instanceScript) {
      programs.push(this.file.instanceScript.program);
    }
    for (const scope of this.model.scopes) {
      if (scope.body?.script && !programs.includes(scope.body.script.program)) {
        programs.push(scope.body.script.program);
      }
    }
    for (const program of programs) {
      const isModule = program === this.file.moduleScript?.program;
      for (const statement of program.body) {
        if (statement.type !== 'ImportDeclaration') {
          continue;
        }
        const all = new Set(statement.specifiers.map((specifier) => specifier.local.name));
        const code = renderImport(this.file, statement, isModule && includeModule ? all : names);
        if (code) {
          result.push(code);
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
          if (template && !result.some((item) => isWithin(template, item))) {
            result.push(template);
          }
        }
      }
    }
    return result;
  }

  /** The module script, when client code reads its bindings. Server functions become stubs. */
  private moduleCode(): string[] {
    return this.usesModuleScript() ? clientModuleScript(this.file, this.plan) : [];
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

  private emitServerStubs(): void {
    for (const declaration of this.model.declarations) {
      if (declaration.kind !== 'server-function' || declaration.scope === this.model.module) {
        continue;
      }
      const used = [...this.clientReads()].includes(declaration);
      if (used) {
        this.usedServer.add(declaration);
        const ref = `${this.plan.id}#${declaration.name}`;
        this.emit(`const ${declaration.name}$ = (...$$a) => $$b.rpc(${JSON.stringify(ref)}, $$a);`);
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
      this.emit(fn.type === 'FunctionDeclaration' ? code : `const ${declaration.name}$ = ${code};`);
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
      // TODO: update style variables when styles are compiled.
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
      if (scope.kind === 'body' && scope.block?.kind === 'client' && scope.body) {
        this.renders.set(scope, { body: scope.body, block: scope.block });
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
      if (!isInside(site.scope) || DEFERRED_SITES.has(site.kind)) {
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
