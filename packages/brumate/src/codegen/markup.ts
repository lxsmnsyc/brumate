import type {
  Attribute,
  Block,
  Body,
  ComponentNode,
  DynamicTagNode,
  ElementNode,
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
  instanceScope,
  isMemo,
  scopePath,
  slotIndex,
} from './scopes.ts';
import { copy, unmarked } from '../sourcemap.ts';

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

/** The name of the compile-time function that a declarator calls, for `$context` and `$id`. */
function specialCall(declarator: oxc.VariableDeclarator): '$context' | '$id' | undefined {
  const init = declarator.init;
  if (init?.type !== 'CallExpression' || init.callee.type !== 'Identifier') {
    return undefined;
  }
  const name = init.callee.name;
  return name === '$context' || name === '$id' ? name : undefined;
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
  /** Async memos that the server awaits where they are declared. */
  private readonly blocking: Set<Declaration>;
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
    this.blocking = blockingMemos(plan);
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
      `const ${this.scopeVar(scope)} = $$ctx.scope(${scope.id}, ${this.scopeVar(parent)});`,
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
      this.line(`$$ctx.slots(${this.scopeVar(scope)}, [${values.join(', ')}]${names});`);
    }
  }

  /** True for an async memo that is a promise where its scope ends, on the server. */
  private isPromise(declaration: Declaration): boolean {
    return this.options.mode === 'server' && isMemo(declaration) && !this.blocking.has(declaration);
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
      if (declaration && isMemo(declaration) && this.blocking.has(declaration)) {
        this.line(`const ${declaration.name} = await $$b.wait(${promiseName(declaration.name)});`);
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
          this.line(`$$ctx.title(${this.source(expression.arguments[0])});`);
          continue;
        }
        if (name === '$provide' && expression.type === 'CallExpression') {
          const [context, value] = expression.arguments;
          if (context && value) {
            const target = this.scopeVar(instanceScope(this.plan, scope));
            this.line(
              `$$ctx.provide(${this.source(context)}, ${this.providedValue(value, scope)}, ${target});`,
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
        this.line(`const ${declaration.name} = $$ctx.id(${target}, ${declaration.idIndex});`);
        continue;
      }
      if (call !== '$context' || declarator.id.type !== 'Identifier' || !init.arguments[0]) {
        this.line(`${statement.kind} ${this.source(declarator)};`);
        continue;
      }
      const slot = declaration ? slotIndex(this.plan, declaration) : -1;
      // The slot is recorded, so a change to the provided value reaches it on the client.
      const record = slot === -1 ? '' : `, ${slot}`;
      this.line(
        `const ${declarator.id.name} = $$ctx.consume(${this.source(init.arguments[0])}, ${target}${record});`,
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
      this.html('<template data-b="');
      this.code(anchor.scope);
      this.html(
        `:${anchor.index}" data-client="${site.trigger}=${this.plan.id}#${this.plan.symbols.get(site)}"></template>`,
      );
    }
  }

  /** Emits the content of the component, without creating its scope. */
  emitComponentContent(setup: oxc.Node[]): void {
    const component = this.plan.graph.model.component;
    if (this.plan.styles.css) {
      // The stylesheet is written once per page, before the first instance.
      this.code(`$$ctx.style(${JSON.stringify(this.plan.id)}, $$css)`);
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

  /** Emits one item of `#for` or `#repeat`, given expressions for the item and its index. */
  emitItem(block: ForBlock | RepeatBlock, item: string, index: string): void {
    const scope = this.plan.bodyScopes.get(block.body)!;
    const anchored = this.plan.anchors.has(block);
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
    if (anchored) {
      this.line(`$$ctx.item(${this.scopeVar(scope)}, ${item});`);
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

  private emitNode(node: Markup, scope: Scope): void {
    switch (node.kind) {
      case 'text':
        this.html(cleanText(node.value));
        return;
      case 'insert': {
        const anchor = this.anchor(scope, node);
        // On the server, the insert knows where it is, for markup that renders there, such as children.
        const at =
          this.options.mode === 'server'
            ? `, $$ctx, ${this.scopeVar(instanceScope(this.plan, scope))}`
            : '';
        const value = `${this.wait}$$b.insert(${this.expression(node.expression)}${at})`;
        if (anchor) {
          this.html('<!--t');
          this.code(anchor.scope);
          this.html(`:${anchor.index}-->`);
          this.code(value);
          this.html('<!--/t-->');
        } else {
          this.code(value);
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
        const events = node.attributes.map((attribute) =>
          this.eventEntry(attribute.event, attribute.modifiers, attribute.handler),
        );
        this.html('<template data-b="');
        this.code(anchor.scope);
        this.html(
          `:${anchor.index}" data-listen="${node.target}" data-on="${events.join(' ')}"></template>`,
        );
        return;
      }
      default:
        this.emitBlock(node, scope);
    }
  }

  private eventEntry(event: string, modifiers: string[], handler: Expression): string {
    const site = this.sitesByNode.get(handler.ast)!;
    const name = [event, ...modifiers].join(':');
    return `${name}=${this.plan.id}#${this.plan.symbols.get(site)}`;
  }

  private emitRef(
    target: string,
    attribute: object,
    anchor: { scope: string; index: number },
  ): void {
    const declaration = this.refTargets.get(attribute);
    const element = `$$ctx.element(${anchor.scope}, ${anchor.index})`;
    const outer = this.options.outer;
    if (declaration && outer && !this.isInside(declaration.scope)) {
      // The signal belongs to a scope outside this render, so it is written after the element is in the page.
      const path = scopePath(this.plan, outer.baseVar, outer.base, declaration.scope);
      this.line(
        `$$ctx.after(() => $$b.set(${path}, ${slotIndex(this.plan, declaration)}, ${element}));`,
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
      this.html(' data-v="');
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
    this.html(`<${node.tag}`);
    if (this.plan.styles.css) {
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
          this.code(
            `$$b.attribute(${JSON.stringify(attribute.name)}, ${this.expression(attribute.value)})`,
          );
          break;
        }
        case 'spread':
          this.code(`$$b.spread(${this.expression(attribute.value)})`);
          break;
        case 'computed':
          this.code(
            `$$b.attribute(${this.expression(attribute.name)}, ${attribute.value === true ? 'true' : this.expression(attribute.value)})`,
          );
          break;
        case 'event':
          events.push(this.eventEntry(attribute.event, attribute.modifiers, attribute.handler));
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
      this.html(' data-b="');
      this.code(anchor.scope);
      this.html(`:${anchor.index}"`);
    }
    if (events.length > 0) {
      this.html(` data-on="${events.join(' ')}"`);
      if (prefetch) {
        this.html(` data-prefetch="${prefetch}"`);
      }
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
    this.line(`const ${name} = ${this.wait}(${this.async}() => {`);
    this.line(`let $$html = '';`);
    this.atTopLevel(() => this.emitNodes(nodes, scope));
    this.flush();
    this.line('return $$b.raw($$html);');
    this.close('})();');
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
        ? `$$ctx.fn(${code}, ${JSON.stringify(`${this.plan.id}#${symbol}`)}, ${instance})`
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
      return `$$ctx.fn(${code}, ${JSON.stringify(`${this.plan.id}#${symbol}`)}, ${instance})`;
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
    this.code(`${this.wait}$$b.component(${node.name}, ${props}, $$ctx, ${owner}${link})`);
  }

  private emitDynamic(node: DynamicTagNode, scope: Scope): void {
    const childrenName = this.emitChildren(node.children, scope);
    const extra: string[] = [];
    if (this.plan.styles.css) {
      extra.push(`${JSON.stringify(this.plan.styles.attribute)}: true`);
    }
    const anchor = this.anchor(scope, node);
    if (anchor) {
      extra.push(`"data-b": \`\${${anchor.scope}}:${anchor.index}\``);
    }
    const events = node.attributes.flatMap((attribute) =>
      attribute.kind === 'event'
        ? [this.eventEntry(attribute.event, attribute.modifiers, attribute.handler)]
        : [],
    );
    if (events.length > 0) {
      extra.push(`"data-on": ${JSON.stringify(events.join(' '))}`);
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
        extra.push(`"data-v": ${this.scopeVar(this.plan.graph.model.component)}`);
      }
    }
    this.code(
      `${this.wait}$$b.dynamic(${this.expression(node.tag)}, ${this.props(attributes, scope, extra)}, ${childrenName ?? 'undefined'}, $$ctx, ${this.scopeVar(instanceScope(this.plan, scope))})`,
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
      this.html('<template data-b="');
      this.code(anchor.scope);
      this.html(`:${anchor.index}" data-client="load=${this.plan.id}#k${body.id}"></template>`);
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
    this.line(`$$ctx.${block.kind === 'head' ? 'head' : 'portal'}(${name});`);
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
      this.line(`const ${declaration.name} = await $$b.wait(${promiseName(declaration.name)});`);
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
          this.line(`const ${list} = Array.from(${this.expression(block.list)});`);
        } else {
          this.line(
            `const ${list} = Array.from({ length: ${this.expression(block.count)} }, (_, index) => index);`,
          );
        }
        this.open(scope, block);
        this.line(`for (const [${index}, ${item}] of ${list}.entries()) {`);
        this.emitItem(block, item, index);
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
        this.open(scope, block);
        this.flush();
        this.line(`const ${before} = $$html;`);
        this.line('try {');
        this.emitBody(block.body);
        this.close(`} catch (${error}) {`);
        this.line(`$$html = ${before};`);
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
        this.html('<template data-b="');
        this.code(anchor.scope);
        this.html(
          `:${anchor.index}" data-client="${block.trigger}=${this.plan.id}#k${body.id}"></template>`,
        );
        this.open(scope, block);
        this.end(block);
        return;
      }
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

/** The value of a style variable, with the text around its interpolation, such as a unit. */
export function variableValue(
  variable: { prefix: string; suffix: string },
  expression: string,
): string {
  return variable.prefix || variable.suffix
    ? `$$b.affix(${JSON.stringify(variable.prefix)}, ${expression}, ${JSON.stringify(variable.suffix)})`
    : expression;
}
