import type {
  Attribute,
  Block,
  Body,
  ComponentNode,
  DynamicTagNode,
  ElementNode,
  EventAttribute,
  Expression,
  ForBlock,
  Markup,
  RepeatBlock,
  SFCFile,
  TemplateDecl,
} from '../ast.ts';
import { isWithin, lookup } from '../model.ts';
import type { Declaration, Scope, Site } from '../model.ts';
import type { oxc } from '../oxc.ts';
import { serverFunctionId } from '../plan.ts';
import type { Plan } from '../plan.ts';
import { cleanText, promiseName } from './patch.ts';
import type { Patch } from './patch.ts';
import {
  awaitedMemos,
  blockingMemos,
  plainValues,
  instanceScope,
  isMemo,
  isPrimitive,
  readsPlain,
  scopePath,
  slotIndex,
} from './scopes.ts';
import { needsScope } from '../css.ts';
import { copy, unmarked } from '../sourcemap.ts';
import { insertValue } from '../runtime/html.ts';

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

export const TYPE_DECLARATIONS: Set<string> = new Set([
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSDeclareFunction',
  'TSModuleDeclaration',
]);

type Part = { static: string } | { code: string };

/** The name of the compile-time function that a declarator calls, for `$getContext` and `$id`. */
function specialCall(declarator: oxc.VariableDeclarator): '$getContext' | '$id' | undefined {
  const init = declarator.init;
  if (init?.type !== 'CallExpression' || init.callee.type !== 'Identifier') {
    return undefined;
  }
  const name = init.callee.name;
  return name === '$getContext' || name === '$id' ? name : undefined;
}

export interface EmitterOptions {
  mode: 'server' | 'client';
  /**
   * Keeps local functions in client code. Render functions of a client
   * module skip them, because the module has its own copies that read slots.
   */
  functions?: boolean;
  /**
   * For a client render function: the scopes it renders (a body and the
   * templates it calls), the scope that contains the body, and the
   * expression for that scope's instance.
   */
  outer?: { inside: Scope[]; base: Scope; baseVar: string };
}

/** Writes code that renders markup to an HTML string, on the server or on the client. */
/** The exports of the core that do on the client what the server's render context does. */
const CLIENT_HELPERS: Record<string, string> = {
  scope: 'createScope',
  slots: 'setSlots',
  item: 'setItem',
  element: 'elementAt',
  id: 'makeId',
  own: 'setOwner',
  provide: 'provideValue',
  consume: 'consumeContext',
  head: 'addHead',
  portal: 'addPortal',
  style: 'addStyle',
  fn: 'handlerProp',
  after: 'afterInsert',
  title: 'title',
};

/** The markup of an inserted literal, such as `{'<b>'}`, or undefined for other code. */
function literalText(node: oxc.Node): string | undefined {
  if (node.type === 'Literal') {
    return 'regex' in node && node.regex ? undefined : insertValue(node.value);
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return insertValue(node.quasis[0]!.value.cooked);
  }
  return undefined;
}

/**
 * Blocks whose shape on the server depends on data: which branch renders,
 * how many items a list has, whether a body throws or shows. The server
 * numbers the scopes of their bodies after an ID of the block's own.
 */
const DATA_SHAPED = new Set(['if', 'switch', 'for', 'repeat', 'try', 'offscreen']);

export class Emitter {
  readonly lines: string[] = [];
  private readonly file: SFCFile;
  private readonly plan: Plan;
  private readonly patch: Patch;
  private readonly options: EmitterOptions;
  private readonly sitesByNode = new Map<object, Site>();
  private readonly refTargets = new Map<object, Declaration>();
  private readonly wait: string;
  private readonly async: string;
  /** The render context as an argument, which the client's helpers do not take. */
  private readonly ctxArgument: string;
  /** Async memos that the server awaits where they are declared. */
  private readonly blocking: Set<Declaration>;
  /** Memos and signals that hold a primitive on the server, so it awaits none of them. */
  private readonly inline: Set<Declaration>;
  private parts: Part[] = [];
  private depth = 0;
  /** How many of this component's elements contain the current node. */
  private nesting = 0;
  private counter = 0;

  constructor(file: SFCFile, plan: Plan, patch: Patch, options: EmitterOptions) {
    this.file = file;
    this.plan = plan;
    this.patch = patch;
    this.options = options;
    this.wait = options.mode === 'server' ? 'await ' : '';
    this.async = options.mode === 'server' ? 'async ' : '';
    this.ctxArgument = options.mode === 'server' ? '$$ctx' : 'undefined';
    this.blocking = blockingMemos(plan);
    this.inline = options.mode === 'server' ? plainValues(plan, this.blocking) : new Set();
    for (const site of plan.graph.model.sites) {
      this.sitesByNode.set(site.node, site);
    }
    for (const declaration of plan.graph.model.declarations) {
      for (const ref of declaration.refs) {
        this.refTargets.set(ref.attribute, declaration);
      }
    }
  }

  // Output

  line(code: string): void {
    this.flush();
    this.lines.push(`${'  '.repeat(this.depth)}${code}`);
    if (code.endsWith('{')) {
      this.depth++;
    }
  }

  close(code = '}'): void {
    this.flush();
    this.depth--;
    this.lines.push(`${'  '.repeat(this.depth)}${code}`);
    if (code.endsWith('{')) {
      this.depth++;
    }
  }

  /** Copies source code, keeping the indentation of its lines relative to the first. */
  raw(code: string, offset: number): void {
    this.flush();
    const lineStart = this.file.source.lastIndexOf('\n', offset - 1) + 1;
    const column = offset - lineStart;
    const indent = '  '.repeat(this.depth);
    code.split('\n').forEach((line, index) => {
      const text = index === 0 ? line : line.replace(new RegExp(`^ {0,${column}}`), '');
      this.lines.push(unmarked(text).trim() === '' ? '' : `${indent}${text}`);
    });
  }

  private html(text: string): void {
    const last = this.parts.at(-1);
    if (last && 'static' in last) {
      last.static += text;
    } else {
      this.parts.push({ static: text });
    }
  }

  private code(code: string): void {
    this.parts.push({ code });
  }

  flush(): void {
    if (this.parts.length === 0) {
      return;
    }
    const parts = this.parts;
    this.parts = [];
    const value = parts
      .map((part) => ('static' in part ? JSON.stringify(part.static) : part.code))
      .join(' + ');
    this.lines.push(`${'  '.repeat(this.depth)}$$html += ${value};`);
  }

  /**
   * The value of a runtime call that returns a string, or a promise when it
   * is not ready. The server awaits only a promise, because most values are
   * ready and each await pauses the render. `$$t` is a variable of the
   * module. Nothing runs between its write and its read.
   */
  private ready(call: string): string {
    return this.options.mode === 'server'
      ? `(typeof ($$t = ${call}) === 'string' ? $$t : await $$t)`
      : call;
  }

  /** The value of a memo, which the server awaits only when it is still loading. */
  private memoValue(name: string): string {
    return `(($$t = $$b.ready(${promiseName(name)})) instanceof Promise ? await $$t : $$t)`;
  }

  private unique(prefix: string): string {
    return `$$${prefix}${this.counter++}`;
  }

  private expression(expression: Expression): string {
    return `(${this.patch.slice(expression.start, expression.end)})`;
  }

  // Scopes

  /** The expression for the instance of a scope that gets an ID. */
  scopeVar(scope: Scope): string {
    const outer = this.options.outer;
    if (outer && !this.isInside(scope)) {
      return scopePath(this.plan, outer.baseVar, outer.base, scope);
    }
    return `$$s${scope.id}`;
  }

  /** True if a client render function renders the scope, so its variables are local. */
  private isInside(scope: Scope): boolean {
    const outer = this.options.outer;
    return !outer || outer.inside.some((item) => isWithin(scope, item));
  }

  private anchor(scope: Scope, target: object): { scope: string; index: number } | undefined {
    const index = this.plan.anchors.get(target as Markup);
    return index === undefined ? undefined : { scope: this.scopeVar(scope), index };
  }

  /** Creates the instance of a body scope. */
  private createScope(scope: Scope): void {
    const parent = instanceScope(this.plan, scope.parent!);
    this.line(
      `const ${this.scopeVar(scope)} = ${this.helper('scope')}(${scope.id}, ${this.scopeVar(parent)});`,
    );
  }

  emitSlots(scope: Scope): void {
    const slots = this.plan.scopes.get(scope)?.slots ?? [];
    if (slots.length > 0) {
      const values = slots.map((slot) =>
        this.isPromise(slot) ? `$$b.wait(${promiseName(slot.name)})` : slot.name,
      );
      // The server also passes the names, so an error can say which value cannot be sent.
      const names =
        this.options.mode === 'server' ? `, ${JSON.stringify(slots.map((slot) => slot.name))}` : '';
      this.line(
        `${this.helper('slots')}(${this.scopeVar(scope)}, [${values.join(', ')}]${names});`,
      );
    }
  }

  /** True if the server inserts a primitive, such as a memo that it computes as a plain value. */
  private isPrimitiveInsert(expression: Expression): boolean {
    if (this.options.mode !== 'server') {
      return false;
    }
    const site = this.sitesByNode.get(expression.ast);
    return isPrimitive(expression.ast, (name) =>
      readsPlain(site, name, (declaration) => this.inline.has(declaration)),
    );
  }

  /** True for an async memo that is a promise where its scope ends, on the server. */
  private isPromise(declaration: Declaration): boolean {
    return (
      this.options.mode === 'server' &&
      isMemo(declaration) &&
      !this.blocking.has(declaration) &&
      !this.inline.has(declaration)
    );
  }

  /** Awaits the async memos of a statement that markup outside `#loading` reads. */
  private awaitMemos(statement: oxc.Node): void {
    if (this.options.mode !== 'server' || statement.type !== 'VariableDeclaration') {
      return;
    }
    for (const declarator of statement.declarations) {
      const init = declarator.init;
      const argument = init?.type === 'CallExpression' ? init.arguments[0] : undefined;
      const declaration = argument && this.sitesByNode.get(argument)?.declaration;
      if (
        declaration &&
        isMemo(declaration) &&
        this.blocking.has(declaration) &&
        !this.inline.has(declaration)
      ) {
        this.line(`const ${declaration.name} = ${this.memoValue(declaration.name)};`);
      }
    }
  }

  emitStatements(statements: oxc.Node[], scope: Scope): void {
    for (const statement of statements) {
      if (statement.type === 'ExpressionStatement') {
        const expression = statement.expression;
        const name =
          expression.type === 'CallExpression' && expression.callee.type === 'Identifier'
            ? expression.callee.name
            : undefined;
        if (name === '$effect' || name === '$client') {
          continue;
        }
        if (name === '$title' && expression.type === 'CallExpression' && expression.arguments[0]) {
          this.line(`${this.helper('title')}(${this.source(expression.arguments[0])});`);
          continue;
        }
        if (name === '$setContext' && expression.type === 'CallExpression') {
          const [context, value] = expression.arguments;
          if (context && value) {
            const target = this.scopeVar(instanceScope(this.plan, scope));
            this.line(
              `${this.helper('provide')}(${this.source(context)}, ${this.providedValue(value, scope)}, ${target});`,
            );
          }
          continue;
        }
      }
      if (statement.type === 'VariableDeclaration' && this.emitContexts(statement, scope)) {
        continue;
      }
      if (statement.type === 'ImportDeclaration' || TYPE_DECLARATIONS.has(statement.type)) {
        continue;
      }
      if (this.options.mode === 'client') {
        if (this.isServerStatement(statement)) {
          // Server functions are stubs at the top of the module.
          continue;
        }
        if (!this.options.functions && this.isFunctionStatement(statement)) {
          // Client functions are module functions in the client module.
          continue;
        }
      }
      this.raw(this.patch.slice(statement.start, statement.end), statement.start);
      this.awaitMemos(statement);
    }
  }

  private source(node: { start: number; end: number }): string {
    return this.patch.slice(node.start, node.end);
  }

  /**
   * Writes the declarations of a statement that reads contexts or creates
   * IDs, one per line. Returns false if the statement does neither.
   */
  private emitContexts(statement: oxc.VariableDeclaration, scope: Scope): boolean {
    if (!statement.declarations.some((declarator) => specialCall(declarator))) {
      return false;
    }
    const target = this.scopeVar(instanceScope(this.plan, scope));
    for (const declarator of statement.declarations) {
      const init = declarator.init as oxc.CallExpression;
      const call = specialCall(declarator);
      const declaration =
        declarator.id.type === 'Identifier'
          ? scope.declarations.get(declarator.id.name)
          : undefined;
      if (call === '$id' && declaration?.idIndex !== undefined) {
        this.line(
          `const ${declaration.name} = ${this.helper('id')}(${target}, ${declaration.idIndex});`,
        );
        continue;
      }
      if (call !== '$getContext' || declarator.id.type !== 'Identifier' || !init.arguments[0]) {
        this.line(`${statement.kind} ${this.source(declarator)};`);
        continue;
      }
      const slot = declaration ? slotIndex(this.plan, declaration) : -1;
      // The slot is recorded, so a change to the provided value reaches it on the client.
      const record = slot === -1 ? '' : `, ${slot}`;
      this.line(
        `const ${declarator.id.name} = ${this.helper('consume')}(${this.source(init.arguments[0])}, ${target}${record});`,
      );
    }
    return true;
  }

  private isServerStatement(statement: oxc.Node): boolean {
    const nodes =
      statement.type === 'VariableDeclaration'
        ? statement.declarations.map((declarator) => declarator.init)
        : [statement];
    return nodes.every((node) => node && this.sitesByNode.get(node)?.kind === 'server-function');
  }

  private isFunctionStatement(statement: oxc.Node): boolean {
    if (statement.type === 'FunctionDeclaration') {
      return true;
    }
    if (statement.type !== 'VariableDeclaration') {
      return false;
    }
    return statement.declarations.every((declarator) => {
      const init = declarator.init;
      return init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression';
    });
  }

  /** Emits `<template>` markers for the `$client` callbacks of a scope. */
  private emitClientAnchors(scope: Scope): void {
    for (const site of this.plan.graph.model.sites) {
      if (site.kind !== 'client' || site.scope !== scope) {
        continue;
      }
      const anchor = this.anchor(scope, site)!;
      this.html('<template b-b="');
      this.code(anchor.scope);
      this.html(
        `:${anchor.index}" b-client="${site.trigger}=${this.plan.id}#${this.plan.symbols.get(site)}"></template>`,
      );
    }
  }

  /** Emits the content of the component, without creating its scope. */
  emitComponentContent(setup: oxc.Node[]): void {
    const component = this.plan.graph.model.component;
    if (this.plan.styles.css) {
      // The stylesheet is written once per page, before the first instance.
      this.code(`${this.helper('style')}(${JSON.stringify(this.plan.id)}, $$css)`);
    }
    this.emitStatements(setup, component);
    for (const template of this.file.templates) {
      this.emitTemplate(template);
    }
    this.emitClientAnchors(component);
    this.emitNodes(this.file.children, component);
    this.emitSlots(component);
    this.flush();
  }

  /** Emits a body: its scope, script, templates, markup and slots. */
  emitBody(body: Body, createScope = true): void {
    const scope = this.plan.bodyScopes.get(body)!;
    const plan = this.plan.scopes.get(scope)!;
    if (plan.needsId && createScope) {
      this.createScope(scope);
    }
    if (body.script) {
      this.emitStatements(body.script.program.body, scope);
    }
    for (const template of body.templates) {
      this.emitTemplate(template);
    }
    this.emitClientAnchors(scope);
    this.emitNodes(body.children, scope);
    this.emitSlots(scope);
  }

  /**
   * On the server, the scope and slot of the list of a `#for` whose list is
   * a signal, memo or prop of an enclosing scope that the client gets, as an
   * expression. The client then takes each item from that list, and the
   * server does not write it. The server checks that each item is the value
   * of the list at its position before it leaves one out.
   */
  private itemSource(block: ForBlock | RepeatBlock): string | undefined {
    if (
      this.options.mode !== 'server' ||
      block.kind !== 'for' ||
      block.list.ast.type !== 'Identifier' ||
      block.item.type !== 'Identifier' ||
      !this.plan.anchors.has(block)
    ) {
      return undefined;
    }
    const scope = this.plan.bodyScopes.get(block.body)!.parent!;
    const declaration = lookup(scope, block.list.ast.name);
    if (!declaration || !['signal', 'memo', 'prop'].includes(declaration.kind)) {
      return undefined;
    }
    // A template renders anywhere, so its scopes are not the ones around its markup.
    for (let current: Scope | undefined = scope; current; current = current.parent) {
      if (current.kind === 'template') {
        return undefined;
      }
      if (current === declaration.scope) {
        break;
      }
    }
    const slot = this.plan.scopes.get(declaration.scope)?.slots.indexOf(declaration) ?? -1;
    return slot === -1 ? undefined : `[${this.scopeVar(declaration.scope)}, ${slot}]`;
  }

  /**
   * Emits one item of `#for` or `#repeat`, given expressions for the item and
   * its index, and on the server the scope and slot of its list.
   */
  emitItem(block: ForBlock | RepeatBlock, item: string, index: string, source?: string): void {
    const scope = this.plan.bodyScopes.get(block.body)!;
    // An item whose markup is one element is marked by the element's `b-b`.
    const anchored = this.plan.anchors.has(block) && !this.plan.elementItems.has(block);
    if (block.kind === 'for') {
      this.line(`const ${copy(this.file.source, block.item.start, block.item.end)} = ${item};`);
    }
    if (block.index) {
      this.line(`const ${block.index.name} = ${index};`);
    }
    const needsId = this.plan.scopes.get(scope)!.needsId;
    if (needsId) {
      this.createScope(scope);
    }
    if (anchored) {
      this.html('<!--i');
      this.code(this.scopeVar(scope));
      this.html('-->');
    }
    this.emitBody(block.body, false);
    if (this.plan.anchors.has(block)) {
      const from = source ? `, ${source}` : '';
      this.line(`${this.helper('item')}(${this.scopeVar(scope)}, ${item}${from});`);
    }
    if (anchored) {
      this.html('<!--/i-->');
    }
  }

  emitTemplate(template: TemplateDecl): void {
    const first = template.params[0];
    const last = template.params.at(-1);
    const params = first && last ? copy(this.file.source, first.start, last.end) : '';
    const type = this.options.mode === 'server' ? ': Promise<$$b.Raw>' : '';
    this.line(`${this.async}function ${template.name}(${params})${type} {`);
    this.line(`let $$html = '';`);
    // A template can render anywhere, so its elements get the style variables.
    this.atTopLevel(() => this.emitBody(template.body));
    this.flush();
    this.line('return $$b.raw($$html);');
    this.close();
  }

  // Markup

  emitNodes(nodes: Markup[], scope: Scope): void {
    for (const node of nodes) {
      this.emitNode(node, scope);
    }
  }

  /**
   * A render helper: a method of the render context on the server, and an
   * export of the core on the client, where a build keeps only the helpers
   * that its components call.
   */
  private helper(name: string): string {
    return this.options.mode === 'server' ? `$$ctx.${name}` : `$$b.${CLIENT_HELPERS[name]!}`;
  }

  private emitNode(node: Markup, scope: Scope): void {
    switch (node.kind) {
      case 'text':
        this.html(cleanText(node.value));
        return;
      case 'insert': {
        const anchor = this.anchor(scope, node);
        // On the server, the insert knows where it is, for markup that renders there, such as children.
        // In the browser, only a prop can hold children, which render where they are inserted.
        const ast = node.expression.ast;
        const kind = ast.type === 'Identifier' ? lookup(scope, ast.name)?.kind : undefined;
        const at =
          this.options.mode === 'server' || kind === 'prop' || kind === 'props-rest'
            ? `, ${this.ctxArgument}, ${this.scopeVar(instanceScope(this.plan, scope))}`
            : '';
        // A primitive renders as text, so it needs neither the place of the insert nor an await.
        const value = this.isPrimitiveInsert(node.expression)
          ? `$$b.insert(${this.expression(node.expression)})`
          : this.ready(`$$b.insert(${this.expression(node.expression)}${at})`);
        // A literal renders when the component compiles.
        const text = literalText(node.expression.ast);
        const emitValue = (): void => (text === undefined ? this.code(value) : this.html(text));
        // An insert that is the whole content of its element updates through the element's anchor.
        if (anchor && !this.plan.contents.has(node)) {
          this.html('<!--t');
          this.code(anchor.scope);
          this.html(`:${anchor.index}-->`);
          emitValue();
          this.html('<!--/t-->');
        } else {
          emitValue();
        }
        return;
      }
      case 'element':
        this.emitElement(node, scope);
        return;
      case 'component':
        this.emitComponent(node, scope);
        return;
      case 'dynamic':
        this.emitDynamic(node, scope);
        return;
      case 'fragment':
        this.emitNodes(node.children, scope);
        return;
      case 'listener': {
        const anchor = this.anchor(scope, node)!;
        const events = node.attributes.map((attribute) => this.eventEntry(attribute));
        this.html('<template b-b="');
        this.code(anchor.scope);
        this.html(
          `:${anchor.index}" b-listen="${node.target}" b-on="${events.join(' ')}"></template>`,
        );
        return;
      }
      default:
        if (this.options.mode === 'server' && DATA_SHAPED.has(node.kind)) {
          // The markup after the block keeps its IDs, whatever the block rendered.
          this.line('$$ctx.enter();');
          this.emitBlock(node, scope);
          this.line('$$ctx.leave();');
        } else {
          this.emitBlock(node, scope);
        }
    }
  }

  private eventEntry({ event, modifiers, handler }: EventAttribute): string {
    const site = this.sitesByNode.get(handler.ast)!;
    // The modifiers of the attribute name, and those of the wrappers of `brumate/events`.
    const all = [...new Set([...modifiers, ...(site.modifiers ?? [])])];
    return `${[event, ...all].join(':')}=${this.plan.id}#${this.plan.symbols.get(site)}`;
  }

  private emitRef(
    target: string,
    attribute: object,
    anchor: { scope: string; index: number },
  ): void {
    const declaration = this.refTargets.get(attribute);
    const element = `${this.helper('element')}(${anchor.scope}, ${anchor.index})`;
    const outer = this.options.outer;
    if (declaration && outer && !this.isInside(declaration.scope)) {
      // The signal belongs to a scope outside this render, so it is written after the element is in the page.
      const path = scopePath(this.plan, outer.baseVar, outer.base, declaration.scope);
      this.line(
        `${this.helper('after')}.push(() => $$b.set(${path}, ${slotIndex(this.plan, declaration)}, ${element}));`,
      );
    } else {
      this.line(`${target} = ${element};`);
    }
  }

  /**
   * The style attribute of a top-level element, with the style variables of
   * the component, so the elements inside inherit them.
   */
  private emitVariables(node: ElementNode): boolean {
    const { variables } = this.plan.styles;
    if (variables.length === 0 || this.nesting > 0) {
      return false;
    }
    const values = variables.map(
      (variable) =>
        `${JSON.stringify(variable.name)}: ${variableValue(variable, this.expression(variable.expression))}`,
    );
    const own = node.attributes.find(
      (attribute) =>
        (attribute.kind === 'static' || attribute.kind === 'value') && attribute.name === 'style',
    );
    let existing = 'undefined';
    if (own?.kind === 'static') {
      existing = own.value === true ? 'undefined' : JSON.stringify(own.value);
    } else if (own?.kind === 'value') {
      existing = this.expression(own.value);
    }
    this.code(`$$b.attribute("style", $$b.vars({ ${values.join(', ')} }, ${existing}))`);
    if (this.plan.liveStyles) {
      // Marks the element, so changes to the variables reach it.
      this.html(' b-v="');
      this.code(this.scopeVar(this.plan.graph.model.component));
      this.html('"');
    }
    return true;
  }

  /**
   * Returns the code for `action={fn}` on a form, or `formaction={fn}` on a
   * button, when `fn` is a server function. The form then posts to the
   * server function without client code. Returns undefined otherwise.
   */
  private formAction(
    node: ElementNode,
    name: string,
    value: Expression,
    scope: Scope,
  ): string | undefined {
    const method = name === 'action' ? 'method' : name === 'formaction' ? 'formmethod' : undefined;
    if (!method || value.ast.type !== 'Identifier') {
      return undefined;
    }
    const declaration = lookup(scope, value.ast.name);
    if (declaration?.kind !== 'server-function') {
      return undefined;
    }
    const ref = JSON.stringify(serverFunctionId(this.plan, declaration.name));
    // The form posts, unless the element sets its own method.
    const hasMethod = node.attributes.some(
      (attribute) => 'name' in attribute && attribute.name === method,
    );
    const methodArgument = hasMethod ? '' : `, ${JSON.stringify(method)}`;
    // A form whose result a `$action` reads posts to its page, and the result is written into that slot.
    const result = name === 'action' ? this.actionSlot(declaration) : undefined;
    const resultArgument = result ? `${hasMethod ? ', undefined' : ''}, ${result}` : '';
    return this.options.mode === 'server'
      ? `$$b.action($$ctx, ${JSON.stringify(name)}, ${ref}${methodArgument}${resultArgument})`
      : `$$b.action(${JSON.stringify(name)}, ${ref}${methodArgument}${resultArgument})`;
  }

  /** The `scope:slot` of the `$action` that reads the result of a server function, as code. */
  private actionSlot(fn: Declaration): string | undefined {
    const declaration = this.plan.graph.model.declarations.find(
      (item) => item.kind === 'action' && item.action === fn.name,
    );
    const slot = declaration ? slotIndex(this.plan, declaration) : -1;
    if (!declaration || slot === -1) {
      return undefined;
    }
    return `\`\${${this.scopeVar(instanceScope(this.plan, declaration.scope))}}:${slot}\``;
  }

  private emitElement(node: ElementNode, scope: Scope): void {
    // On the server, a spread can pass on handlers, such as the `onClick` of `...rest`.
    let spreadHandlers: string | undefined;
    if (
      this.options.mode === 'server' &&
      node.attributes.some((attribute) => attribute.kind === 'spread')
    ) {
      spreadHandlers = this.unique('on');
      this.line(`const ${spreadHandlers}: string[] = [];`);
    }
    this.html(`<${node.tag}`);
    if (this.hasScope(node.tag, staticClasses(node.attributes))) {
      this.html(` ${this.plan.styles.attribute}`);
    }
    const ownStyle = this.emitVariables(node);
    const events: string[] = [];
    let prefetch: string | undefined;
    const anchor = this.anchor(scope, node);
    for (const attribute of node.attributes) {
      if (
        ownStyle &&
        (attribute.kind === 'static' || attribute.kind === 'value') &&
        attribute.name === 'style'
      ) {
        continue;
      }
      switch (attribute.kind) {
        case 'static':
          this.html(
            attribute.value === true
              ? ` ${attribute.name}`
              : ` ${attribute.name}="${attribute.value}"`,
          );
          break;
        case 'value': {
          const action = this.formAction(node, attribute.name, attribute.value, scope);
          if (action) {
            this.code(action);
            break;
          }
          const classes =
            attribute.name === 'class'
              ? literalClasses(attribute.value.ast, (start, end) => this.patch.slice(start, end))
              : undefined;
          if (classes) {
            this.emitClasses(classes);
            break;
          }
          this.code(
            `$$b.attribute(${JSON.stringify(attribute.name)}, ${this.expression(attribute.value)})`,
          );
          break;
        }
        case 'spread':
          this.code(
            `$$b.spread(${this.expression(attribute.value)}${spreadHandlers ? `, ${spreadHandlers}` : ''})`,
          );
          break;
        case 'computed':
          this.code(
            `$$b.attribute(${this.expression(attribute.name)}, ${attribute.value === true ? 'true' : this.expression(attribute.value)})`,
          );
          break;
        case 'event':
          events.push(this.eventEntry(attribute));
          break;
        case 'ref':
          if (anchor) {
            this.emitRef(attribute.target, attribute, anchor);
          }
          break;
        case 'prefetch':
          prefetch = attribute.strategy;
          break;
      }
    }
    if (anchor) {
      this.html(' b-b="');
      this.code(anchor.scope);
      this.html(`:${anchor.index}"`);
    }
    if (spreadHandlers) {
      // One `b-on` for the handlers of the element and those that its spreads pass on.
      this.code(`$$b.onAttribute(${spreadHandlers}, ${JSON.stringify(events.join(' '))})`);
    } else if (events.length > 0) {
      this.html(` b-on="${events.join(' ')}"`);
    }
    if (events.length > 0 && prefetch) {
      this.html(` data-prefetch="${prefetch}"`);
    }
    this.html('>');
    if (VOID_ELEMENTS.has(node.tag)) {
      return;
    }
    this.nesting++;
    this.emitNodes(node.children, scope);
    this.nesting--;
    this.html(`</${node.tag}>`);
  }

  /**
   * Renders a literal `class` value as the runtime renders it, without
   * building the value. A class with a condition is added when the condition
   * is truthy. No class leaves the attribute out.
   */
  private emitClasses(classes: ClassPart[]): void {
    const [first, ...rest] = classes;
    if (!first) {
      return;
    }
    const piece = (part: ClassPart): string => {
      const text = JSON.stringify(` ${escapeClass(part.name)}`);
      return part.condition === undefined ? text : `((${part.condition}) ? ${text} : "")`;
    };
    if (first.condition === undefined) {
      this.html(` class="${escapeClass(first.name)}`);
      for (const part of rest) {
        if (part.condition === undefined) {
          this.html(` ${escapeClass(part.name)}`);
        } else {
          this.code(piece(part));
        }
      }
      this.html('"');
    } else if (rest.length === 0) {
      const text = JSON.stringify(` class="${escapeClass(first.name)}"`);
      this.code(`((${first.condition}) ? ${text} : "")`);
    } else {
      this.code(`$$b.classAttribute(${classes.map(piece).join(' + ')})`);
    }
  }

  /**
   * True if an element gets the scope attribute. In a build, only elements
   * that a scoped selector could match get it. In development, every
   * element of a component with styles gets it, so a change to the styles
   * applies without rendering the page again.
   */
  private hasScope(tag: string | undefined, classes: string[] | undefined): boolean {
    const { css, targets } = this.plan.styles;
    if (!css) {
      return false;
    }
    return !this.plan.hideNames || needsScope(targets, tag, classes);
  }

  /** Runs a callback for markup that renders outside this component's elements, such as children. */
  private atTopLevel(callback: () => void): void {
    const nesting = this.nesting;
    this.nesting = 0;
    callback();
    this.nesting = nesting;
  }

  /** Renders children into a variable, for a component or a dynamic tag. */
  private emitChildren(nodes: Markup[], scope: Scope): string | undefined {
    if (nodes.length === 0) {
      return undefined;
    }
    const name = this.unique('children');
    if (this.options.mode === 'server') {
      // The children render where the component inserts them, so they read its contexts.
      this.line(
        `const ${name} = $$b.children(${this.scopeVar(instanceScope(this.plan, scope))}, async ($$ctx) => {`,
      );
      this.line(`let $$html = '';`);
      this.atTopLevel(() => this.emitNodes(nodes, scope));
      this.flush();
      this.line('return $$html;');
      this.close('});');
      return name;
    }
    this.line(
      `const ${name} = $$b.children(${this.scopeVar(instanceScope(this.plan, scope))}, () => {`,
    );
    this.line(`let $$html = '';`);
    this.atTopLevel(() => this.emitNodes(nodes, scope));
    this.flush();
    this.line('return $$html;');
    this.close('});');
    return name;
  }

  private props(attributes: Attribute[], scope: Scope, extra: string[] = []): string {
    const entries: string[] = [];
    for (const attribute of attributes) {
      switch (attribute.kind) {
        case 'static':
          entries.push(
            `${JSON.stringify(attribute.name)}: ${attribute.value === true ? 'true' : JSON.stringify(attribute.value)}`,
          );
          break;
        case 'value':
          entries.push(
            `${JSON.stringify(attribute.name)}: ${this.propValue(attribute.value, scope)}`,
          );
          break;
        case 'event':
          entries.push(
            `${JSON.stringify(attribute.name)}: ${this.propValue(attribute.handler, scope)}`,
          );
          break;
        case 'spread':
          entries.push(`...${this.expression(attribute.value)}`);
          break;
        case 'computed':
          entries.push(
            `[${this.expression(attribute.name)}]: ${attribute.value === true ? 'true' : this.expression(attribute.value)}`,
          );
          break;
        default:
          break;
      }
    }
    return `{ ${[...entries, ...extra].join(', ')} }`;
  }

  /**
   * A provided value. Its functions are marked, as function props are, so
   * they serialize as references that the browser can call.
   */
  private providedValue(value: oxc.Node, scope: Scope): string {
    const instance = this.scopeVar(instanceScope(this.plan, scope));
    const mark = (part: oxc.Node, method = false): string | undefined => {
      const site = this.sitesByNode.get(part);
      const symbol = site?.kind === 'prop' ? this.plan.symbols.get(site) : undefined;
      // A method, such as `toggle() {}`, is a function expression without the keyword.
      const code = `${method ? 'function ' : ''}${this.source(part)}`;
      return symbol
        ? `${this.helper('fn')}(${code}, ${JSON.stringify(`${this.plan.id}#${symbol}`)}, ${instance})`
        : undefined;
    };
    if (value.type !== 'ObjectExpression') {
      return mark(value) ?? this.source(value);
    }
    let code = '';
    let position = value.start;
    for (const property of value.properties) {
      if (property.type !== 'Property' || property.computed) {
        continue;
      }
      const marked = mark(property.value, property.method);
      if (!marked) {
        continue;
      }
      code += this.patch.slice(position, property.start);
      const key = this.patch.slice(property.key.start, property.key.end);
      code += `${key}: ${marked}`;
      position = property.end;
    }
    return code + this.patch.slice(position, value.end);
  }

  /** A prop value. A client function is marked so it serializes as a reference. */
  private propValue(expression: Expression, scope: Scope): string {
    const code = this.expression(expression);
    const site = this.sitesByNode.get(expression.ast);
    const symbol = site && this.plan.symbols.get(site);
    if (symbol) {
      const instance = this.scopeVar(instanceScope(this.plan, scope));
      return `${this.helper('fn')}(${code}, ${JSON.stringify(`${this.plan.id}#${symbol}`)}, ${instance})`;
    }
    return code;
  }

  private emitComponent(node: ComponentNode, scope: Scope): void {
    const childrenName = this.emitChildren(node.children, scope);
    const props = this.props(
      node.attributes,
      scope,
      childrenName ? [`children: ${childrenName}`] : [],
    );
    const anchor = this.anchor(scope, node);
    // The rendering scope becomes the owner of the child, so the child finds the contexts above it.
    const owner = this.scopeVar(instanceScope(this.plan, scope));
    const link = anchor ? `, ${anchor.index}` : '';
    this.code(
      `${this.wait}$$b.component(${node.name}, ${props}, ${this.ctxArgument}, ${owner}${link})`,
    );
  }

  private emitDynamic(node: DynamicTagNode, scope: Scope): void {
    const childrenName = this.emitChildren(node.children, scope);
    const extra: string[] = [];
    if (this.hasScope(undefined, staticClasses(node.attributes))) {
      extra.push(`${JSON.stringify(this.plan.styles.attribute)}: true`);
    }
    const anchor = this.anchor(scope, node);
    if (anchor) {
      extra.push(`"b-b": \`\${${anchor.scope}}:${anchor.index}\``);
    }
    const events = node.attributes.flatMap((attribute) =>
      attribute.kind === 'event' ? [this.eventEntry(attribute)] : [],
    );
    if (events.length > 0) {
      extra.push(`"b-on": ${JSON.stringify(events.join(' '))}`);
    }
    let attributes = node.attributes.filter((attribute) => attribute.kind !== 'event');
    const { variables } = this.plan.styles;
    if (variables.length > 0 && this.nesting === 0) {
      // A top-level dynamic tag sets the style variables, as a top-level element does.
      const own = attributes.find(
        (attribute) =>
          (attribute.kind === 'static' || attribute.kind === 'value') && attribute.name === 'style',
      );
      let existing = 'undefined';
      if (own?.kind === 'static') {
        existing = own.value === true ? 'undefined' : JSON.stringify(own.value);
      } else if (own?.kind === 'value') {
        existing = this.expression(own.value);
      }
      attributes = attributes.filter((attribute) => attribute !== own);
      const values = variables.map(
        (variable) =>
          `${JSON.stringify(variable.name)}: ${variableValue(variable, this.expression(variable.expression))}`,
      );
      extra.push(`"style": $$b.vars({ ${values.join(', ')} }, ${existing})`);
      if (this.plan.liveStyles) {
        extra.push(`"b-v": ${this.scopeVar(this.plan.graph.model.component)}`);
      }
    }
    this.code(
      this.ready(
        `$$b.dynamic(${this.expression(node.tag)}, ${this.props(attributes, scope, extra)}, ${childrenName ?? 'undefined'}, ${this.ctxArgument}, ${this.scopeVar(instanceScope(this.plan, scope))})`,
      ),
    );
  }

  // Blocks

  /**
   * Renders a portal. Without a target, the body goes to the end of the page,
   * between markers with its scope ID. With a target, the client renders it
   * into the target when the page loads.
   */
  private emitPortal(block: Block & { kind: 'portal' | 'head' }, scope: Scope): void {
    const body = this.plan.bodyScopes.get(block.body)!;
    if (block.kind === 'portal' && block.target) {
      const anchor = this.anchor(scope, block)!;
      this.html('<template b-b="');
      this.code(anchor.scope);
      this.html(`:${anchor.index}" b-client="load=${this.plan.id}#k${body.id}"></template>`);
      return;
    }
    const name = this.unique('portal');
    this.line(`const ${name} = ${this.wait}(${this.async}() => {`);
    this.line(`let $$html = '';`);
    this.createScope(body);
    this.html('<!--P');
    this.code(this.scopeVar(body));
    this.html('-->');
    this.atTopLevel(() => this.emitBody(block.body, false));
    this.html('<!--/P-->');
    this.flush();
    this.line('return $$html;');
    this.close('})();');
    // `#head` content goes to the document's head, and portal content to the end of the page.
    this.line(`${this.helper(block.kind === 'head' ? 'head' : 'portal')}(${name});`);
  }

  /**
   * Writes the fallback of `#loading` and renders its body after the rest of
   * the page, so data that the body waits for does not hold up the page.
   */
  private emitLoading(block: Block & { kind: 'loading' }, scope: Scope): void {
    const boundary = this.unique('boundary');
    const body = this.plan.bodyScopes.get(block.body)!;
    this.line(`const ${boundary} = $$ctx.boundary();`);
    this.open(scope, block);
    this.html('<!--l');
    this.code(boundary);
    this.html('-->');
    if (block.fallback) {
      this.line('{');
      this.emitBody(block.fallback);
      this.close();
    }
    this.html('<!--/l-->');
    this.end(block);
    this.line(`$$ctx.defer(${boundary}, async ($$ctx) => {`);
    this.line(`let $$html = '';`);
    for (const declaration of awaitedMemos(this.plan, body, this.blocking)) {
      if (this.inline.has(declaration)) {
        continue;
      }
      this.line(`const ${declaration.name} = ${this.memoValue(declaration.name)};`);
    }
    this.emitBody(block.body);
    this.flush();
    this.line('return $$html;');
    this.close('});');
  }

  /**
   * Renders the fallback of a `#defer` block between the markers of a
   * boundary, and a template that the loader starts when the trigger fires.
   * The body renders only in the request for it, and replaces the fallback
   * as a `#loading` body does.
   */
  private emitDefer(block: Block & { kind: 'defer' }, scope: Scope): void {
    const boundary = this.unique('boundary');
    const anchor = this.anchor(scope, block)!;
    const body = this.plan.bodyScopes.get(block.body)!;
    this.line(`const ${boundary} = $$ctx.boundary();`);
    this.html('<template b-b="');
    this.code(anchor.scope);
    this.html(`:${anchor.index}" b-defer="${block.trigger}:`);
    this.code(boundary);
    this.html(':');
    this.code('$$ctx.base()');
    this.html('"></template><!--l');
    this.code(boundary);
    this.html('-->');
    if (block.fallback) {
      this.line('{');
      this.emitBody(block.fallback);
      this.close();
    }
    this.html('<!--/l-->');
    this.line(
      `$$ctx.deferBlock(${boundary}, ${anchor.scope} + ${JSON.stringify(`:${anchor.index}`)}, async ($$ctx) => {`,
    );
    this.line(`let $$html = '';`);
    for (const declaration of awaitedMemos(this.plan, body, this.blocking)) {
      if (this.inline.has(declaration)) {
        continue;
      }
      this.line(`const ${declaration.name} = ${this.memoValue(declaration.name)};`);
    }
    this.emitBody(block.body);
    this.flush();
    this.line('return $$html;');
    this.close('});');
  }

  private open(scope: Scope, block: Block, suffix?: string): void {
    const anchor = this.anchor(scope, block);
    if (anchor) {
      this.html('<!--b');
      this.code(anchor.scope);
      this.html(`:${anchor.index}${suffix === undefined ? '' : `:${suffix}`}-->`);
    }
  }

  private end(block: Block): void {
    if (this.plan.anchors.has(block)) {
      this.html('<!--/b-->');
    }
  }

  private emitBlock(block: Block, scope: Scope): void {
    switch (block.kind) {
      case 'if':
      case 'switch': {
        const branches = block.kind === 'if' ? block.branches : block.cases;
        const fallback = block.fallback;
        branches.forEach((branch, index) => {
          if (index === 0) {
            this.line(`if ${this.expression(branch.condition)} {`);
          } else {
            this.close(`} else if ${this.expression(branch.condition)} {`);
          }
          this.open(scope, block, String(index));
          this.emitBody(branch.body);
          this.end(block);
        });
        this.close('} else {');
        this.open(scope, block, fallback ? String(branches.length) : '-1');
        if (fallback) {
          this.emitBody(fallback);
        }
        this.end(block);
        this.close();
        return;
      }
      case 'for':
      case 'repeat': {
        const list = this.unique('list');
        const item = this.unique('item');
        const index = this.unique('index');
        this.line('{');
        if (block.kind === 'for') {
          // An array is read in place. Other iterables become one.
          const value = `${list}v`;
          this.line(`const ${value} = ${this.expression(block.list)};`);
          this.line(`const ${list} = Array.isArray(${value}) ? ${value} : Array.from(${value});`);
        } else {
          this.line(
            `const ${list} = Array.from({ length: ${this.expression(block.count)} }, (_, index) => index);`,
          );
        }
        this.open(scope, block);
        const from = this.itemSource(block);
        const source = from && this.unique('source');
        if (source) {
          // One array for the list, which every item shares.
          this.line(`const ${source} = ${from};`);
        }
        // An indexed loop, without an iterator and an `[index, item]` pair for each item.
        this.line(`for (let ${index} = 0; ${index} < ${list}.length; ${index}++) {`);
        this.line(`const ${item} = ${list}[${index}];`);
        this.emitItem(block, item, index, source);
        this.close();
        if (block.fallback) {
          this.line(`if (${list}.length === 0) {`);
          this.emitBody(block.fallback);
          this.close();
        }
        this.end(block);
        this.close();
        return;
      }
      case 'try': {
        const before = this.unique('before');
        const error = this.unique('error');
        const server = this.options.mode === 'server';
        const mark = server ? this.unique('mark') : undefined;
        this.open(scope, block);
        this.flush();
        this.line(`const ${before} = $$html;`);
        if (mark) {
          this.line(`const ${mark} = $$ctx.mark();`);
        }
        this.line('try {');
        this.emitBody(block.body);
        this.close(`} catch (${error}) {`);
        this.line(`$$html = ${before};`);
        // The body's markup is not sent, so the page must not keep what it added: its
        // scopes, stylesheets, portals, head markup and `#loading` bodies.
        if (mark) {
          this.line(`$$ctx.restore(${mark});`);
        }
        if (block.error) {
          this.line(`const ${block.error.name} = ${error};`);
        }
        if (block.reset) {
          this.line(`const ${block.reset.name} = undefined;`);
        }
        this.emitBody(block.fallback);
        this.close();
        this.end(block);
        return;
      }
      case 'client': {
        const anchor = this.anchor(scope, block)!;
        const body = this.plan.bodyScopes.get(block.body)!;
        this.html('<template b-b="');
        this.code(anchor.scope);
        this.html(
          `:${anchor.index}" b-client="${block.trigger}=${this.plan.id}#k${body.id}"></template>`,
        );
        this.open(scope, block);
        if (block.fallback) {
          this.line('{');
          this.emitBody(block.fallback);
          this.close();
        }
        this.end(block);
        return;
      }
      case 'defer':
        if (this.options.mode === 'server') {
          this.emitDefer(block, scope);
        } else {
          // Markup that the browser renders cannot be rendered again on the server, so it keeps
          // the fallback. The compiler cannot see this when a parent in another file renders it.
          this.line(`$$b.deferInBrowser(${JSON.stringify(this.plan.id)});`);
          if (block.fallback) {
            this.line('{');
            this.emitBody(block.fallback);
            this.close();
          }
        }
        return;
      case 'loading':
        if (this.options.mode === 'server') {
          this.emitLoading(block, scope);
          return;
        }
        this.open(scope, block);
        this.line('{');
        this.emitBody(block.body);
        this.close();
        this.end(block);
        return;
      case 'portal':
      case 'head':
        this.emitPortal(block, scope);
        return;
      case 'offscreen':
        // A hidden body renders the first time it shows. The marker says which of the two
        // it is: 1 for a body that renders, and -1 for one that has not rendered yet.
        this.line(`if ${this.expression(block.visible)} {`);
        this.open(scope, block, '1');
        this.emitBody(block.body);
        this.end(block);
        this.close('} else {');
        this.open(scope, block, '-1');
        this.end(block);
        this.close();
        return;
      default:
        // `#key` renders its body in place.
        this.open(scope, block);
        this.line('{');
        this.emitBody(block.body);
        this.close();
        this.end(block);
    }
  }
}

/**
 * The classes of an element, or undefined when it can have classes that are
 * not known. Code can add classes to an element that it has a ref to or that
 * it handles events of, such as `event.currentTarget.classList`.
 */
function staticClasses(attributes: Attribute[]): string[] | undefined {
  const classes: string[] = [];
  for (const attribute of attributes) {
    if (
      attribute.kind === 'spread' ||
      attribute.kind === 'computed' ||
      attribute.kind === 'ref' ||
      attribute.kind === 'event'
    ) {
      return undefined;
    }
    if (
      (attribute.kind === 'static' || attribute.kind === 'value') &&
      attribute.name.toLowerCase() === 'class'
    ) {
      if (attribute.kind === 'value') {
        return undefined;
      }
      if (attribute.value !== true) {
        classes.push(...attribute.value.split(/\s+/).filter(Boolean));
      }
    }
  }
  return classes;
}

/** A class of a literal `class` value, with the code of its condition if it has one. */
export interface ClassPart {
  name: string;
  condition?: string;
}

/** Escapes a class for an attribute, as the runtime does. */
function escapeClass(name: string): string {
  return name.replace(/[&<"]/g, (char) =>
    char === '&' ? '&amp;' : char === '<' ? '&lt;' : '&quot;',
  );
}

/**
 * The classes of a literal `class` value, such as `{ done: todo.done }` or
 * `['todo', { done: todo.done }]`, in the order that the runtime joins them.
 * `slice` returns the compiled code of a range of the source. Returns
 * undefined for a value that only the runtime can read, such as one with a
 * spread or a computed key.
 */
export function literalClasses(
  value: oxc.Node,
  slice: (start: number, end: number) => string,
): ClassPart[] | undefined {
  if (value.type !== 'ObjectExpression' && value.type !== 'ArrayExpression') {
    return undefined;
  }
  const parts: ClassPart[] = [];
  const visit = (node: oxc.Node | null): boolean => {
    // A hole in an array renders nothing.
    if (node === null) {
      return true;
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
      if (node.value !== '') {
        parts.push({ name: node.value });
      }
      return true;
    }
    if (node.type === 'ArrayExpression') {
      return node.elements.every(visit);
    }
    if (node.type !== 'ObjectExpression') {
      return false;
    }
    const names = new Set<string>();
    for (const property of node.properties) {
      if (
        property.type !== 'Property' ||
        property.kind !== 'init' ||
        property.method ||
        property.computed
      ) {
        return false;
      }
      const { key } = property;
      const name =
        key.type === 'Identifier'
          ? key.name
          : key.type === 'Literal' && typeof key.value === 'string'
            ? key.value
            : undefined;
      // The runtime puts keys like `1` first, `__proto__` sets the prototype, a key that
      // comes again keeps its first place, and an empty key adds a space.
      if (!name || /^\d+$/.test(name) || name === '__proto__' || names.has(name)) {
        return false;
      }
      names.add(name);
      const constant = property.value;
      if (
        constant.type === 'Literal' &&
        (constant.value === null || ['boolean', 'number', 'string'].includes(typeof constant.value))
      ) {
        // A literal condition such as `true` is known now.
        if (constant.value) {
          parts.push({ name });
        }
        continue;
      }
      let condition = slice(property.value.start, property.value.end);
      if (property.shorthand) {
        // A shorthand property that the compiler rewrites becomes `name: value`.
        const whole = slice(property.start, property.end);
        if (whole.startsWith(`${name}: `)) {
          condition = whole.slice(name.length + 2);
        } else if (unmarked(whole) !== name) {
          return false;
        }
      }
      parts.push({ name, condition });
    }
    return true;
  };
  return visit(value) ? parts : undefined;
}

/**
 * The code of the text that the runtime makes of a literal class value,
 * for the client to set. An empty text removes the attribute.
 */
export function classText(classes: ClassPart[]): string {
  if (classes.every((part) => part.condition === undefined)) {
    return JSON.stringify(classes.map((part) => part.name).join(' '));
  }
  const [first] = classes;
  if (classes.length === 1 && first) {
    return `((${first.condition}) ? ${JSON.stringify(first.name)} : "")`;
  }
  const pieces = classes.map((part) => {
    const text = JSON.stringify(` ${part.name}`);
    return part.condition === undefined ? text : `((${part.condition}) ? ${text} : "")`;
  });
  return `(${pieces.join(' + ')}).slice(1)`;
}

/** The value of a style variable, with the text around its interpolation, such as a unit. */
export function variableValue(
  variable: { prefix: string; suffix: string },
  expression: string,
): string {
  return variable.prefix || variable.suffix
    ? `$$b.affix(${JSON.stringify(variable.prefix)}, ${expression}, ${JSON.stringify(variable.suffix)})`
    : expression;
}
