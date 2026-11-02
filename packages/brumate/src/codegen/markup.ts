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
  ValueAttribute,
} from '../ast.ts';
import { isWithin, lookup } from '../model.ts';
import type { Declaration, Scope, Site } from '../model.ts';
import type { oxc } from '../oxc.ts';
import { holdsStream, serverFunctionId } from '../plan.ts';
import { cloneLines } from './template.ts';
import type { Plan } from '../plan.ts';
import { cleanText, promiseName } from './patch.ts';
import type { Patch } from './patch.ts';
import {
  awaitedMemos,
  blockingMemos,
  mayWait,
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
import { paragraphComponents } from '../nesting.ts';

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

/**
 * A memo that a value in the browser render reads, which never changes and can be a promise, and
 * the scope that reports its rejection.
 */
export interface Settled {
  names: string[];
  scope: string;
}

export type Part = { static: string } | { code: string; settled?: Settled };

/** The static or value attribute named `style`. */
function findStyleAttribute(attributes: Attribute[]): Attribute | undefined {
  for (const attribute of attributes) {
    if ((attribute.kind === 'static' || attribute.kind === 'value') && attribute.name === 'style') {
      return attribute;
    }
  }
  return undefined;
}

/** Whether a value holds other values, so functions can sit inside it. */
function nested(node: oxc.Node): boolean {
  return node.type === 'ObjectExpression' || node.type === 'ArrayExpression';
}

/** Whether any attribute is a spread. */
function hasSpread(attributes: readonly { kind: string }[]): boolean {
  for (const attribute of attributes) {
    if (attribute.kind === 'spread') {
      return true;
    }
  }
  return false;
}

/** Whether a site reads a prop or the rest of the props. */
function readsProps(site: Site | undefined): boolean {
  for (const read of site?.reads ?? []) {
    if (read.declaration.kind === 'prop' || read.declaration.kind === 'props-rest') {
      return true;
    }
  }
  return false;
}

/** The name of the compile-time function that a declarator calls, for `$getContext` and `$id`. */
function specialCall(
  declarator: oxc.VariableDeclarator,
): '$getContext' | '$id' | '$isPassed' | '$route' | '$navigation' | undefined {
  const init = declarator.init;
  if (init?.type !== 'CallExpression' || init.callee.type !== 'Identifier') {
    return undefined;
  }
  const name = init.callee.name;
  return name === '$getContext' ||
    name === '$id' ||
    name === '$isPassed' ||
    name === '$route' ||
    name === '$navigation'
    ? name
    : undefined;
}

/** The attribute that sets the method of a form, by the attribute that sets its action. */
const FORM_METHODS = new Map([
  ['action', 'method'],
  ['formaction', 'formmethod'],
]);

/** The contexts that the runtime provides, by the compile-time function that reads them. */
const BUILT_IN_CONTEXTS: Record<string, string> = {
  $route: '$$b.routeContext',
  $navigation: '$$b.navigationContext',
};

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
  /**
   * For a render that clones a template: the render functions of the nested `#if` and `#for`
   * blocks that it fills after the clone, in place of their markup. A block that it gives none
   * for renders inline.
   */
  fills?: (block: Block) => Fill | undefined;
  /**
   * Makes a constant of the module, for the templates that the functions of children clone. The
   * functions of children render HTML without it.
   */
  hoist?: (code: string) => string;
}

/**
 * Where a line of a render is: in which function, by its number, or -1 outside any, and whether
 * in an `if`, a loop or another branch of it. See `Emitter.levels`.
 */
export interface Level {
  fn: number;
  control: boolean;
}

/** The render functions that fill a nested block of a clone. */
export type Fill = { kind: 'if'; renders: string[] } | { kind: 'for'; render: string };

/** Writes code that renders markup to an HTML string, on the server or on the client. */
/** The exports of the core that do on the client what the server's render context does. */
/** The `$handler` calls that each patch has edited, since emitters of a file share its patch. */
const handlerEdits = new WeakMap<Patch, Set<object>>();

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
  bindings: 'bindings',
  after: 'afterInsert',
  restRef: 'restRef',
  title: 'title',
};

/** The named character references that markup reads. Others stay as they are written. */
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  laquo: '\u00ab',
  raquo: '\u00bb',
  middot: '\u00b7',
  bull: '\u2022',
  times: '\u00d7',
  euro: '\u20ac',
};

/**
 * Markup text or a static attribute value, with its character references
 * read. A number that is no character, such as one past 0x10FFFF, reads as
 * U+FFFD, as the browser reads it.
 */
function decodeReferences(html: string): string {
  return html.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      const valid = code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff);
      return valid ? String.fromCodePoint(code) : '\ufffd';
    }
    return NAMED[name.toLowerCase()] ?? match;
  });
}

/** The value of a static attribute, with its character references read. */
export function decodeAttribute(text: string): string {
  return decodeReferences(text);
}

/** The text that markup text shows, with its character references read. */
function decodeText(html: string): string {
  return decodeReferences(html);
}

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
  /** Each `$$html +=` line, by its index in `lines`, with its parts, for cloned templates. */
  readonly flushes: { line: number; parts: Part[] }[] = [];
  /**
   * Where each line of `lines` is, for cloned templates: in which function, the first being 0,
   * and whether in a branch or a loop of it. Plain `{` blocks do not count.
   */
  readonly levels: Level[] = [];
  /** The lines that open or close a plain `{` block, which a clone can drop. */
  readonly plainBraces: Set<number> = new Set();
  /** The kinds of the `{` that are open: of a function, a branch or loop, or a plain block. */
  private braces: { kind: 'fn' | 'control' | 'plain'; fn?: number }[] = [];
  private fnCount = 0;
  /**
   * The calls that fill the nested blocks of a clone, by the scope and the anchor of each block.
   * `$$m` in a call is the start comment of the block.
   */
  readonly fills: Map<string, string> = new Map();
  private readonly file: SFCFile;
  private readonly plan: Plan;
  private readonly patch: Patch;
  private readonly options: EmitterOptions;
  private readonly sitesByNode = new Map<object, Site>();
  private readonly refTargets = new Map<object, Declaration>();
  /** The components inside a `<p>`, which the server checks in development. */
  private readonly inParagraph: Set<object>;
  private readonly wait: string;
  private readonly async: string;
  /** The render context as an argument, which the client's helpers do not take. */
  private readonly ctxArgument: string;
  /** Async memos that the server awaits where they are declared. */
  private readonly blocking: Set<Declaration>;
  /** Memos and signals that hold a primitive on the server, so it awaits none of them. */
  private readonly inline: Set<Declaration>;
  /** The sites of the markup that update in the browser. */
  private readonly liveSites = new Set<Site>();
  private parts: Part[] = [];
  private depth = 0;
  /** How many of this component's elements contain the current node. */
  private nesting = 0;
  /** How many `#head` blocks contain the current node, where a `<title>` sets the title of the page. */
  private headBlocks = 0;
  private counter = 0;
  /** The tags of the elements around the node that renders, innermost last. */
  private readonly elements: string[] = [];

  constructor(file: SFCFile, plan: Plan, patch: Patch, options: EmitterOptions) {
    this.file = file;
    this.plan = plan;
    this.patch = patch;
    this.options = options;
    this.wait = options.mode === 'server' ? 'await ' : '';
    this.async = options.mode === 'server' ? 'async ' : '';
    this.ctxArgument = options.mode === 'server' ? '$$ctx' : 'undefined';
    // Only the dev server checks, so a build carries no hint.
    this.inParagraph =
      options.mode === 'server' && !plan.hideNames ? paragraphComponents(file) : new Set();
    this.blocking = blockingMemos(plan);
    this.inline = options.mode === 'server' ? plainValues(plan, this.blocking) : new Set();
    for (const site of plan.graph.model.sites) {
      this.sitesByNode.set(site.node, site);
    }
    for (const node of plan.graph.nodes) {
      if (node.kind !== 'source' && plan.graph.live.has(node)) {
        this.liveSites.add(node.site);
      }
    }
    this.addHandlerEdits();
    this.addBindEdits();
    for (const declaration of plan.graph.model.declarations) {
      for (const ref of declaration.refs) {
        this.refTargets.set(ref.attribute, declaration);
      }
    }
  }

  /**
   * `$handler(fn, ...args)` marks its function as a client function with its
   * arguments, `fn(fn, "<id>#<export>", scope, [args])`, so a spread can
   * pass it on. The calls are edits of the source, wherever they are in a
   * script. Emitters of one file share its patch, so each call is edited once.
   */
  private addHandlerEdits(): void {
    let edited = handlerEdits.get(this.patch);
    if (!edited) {
      handlerEdits.set(this.patch, (edited = new Set()));
    }
    for (const site of this.plan.graph.model.sites) {
      const call = site.handler;
      const fn = call?.arguments[0];
      if (!call || !fn || edited.has(call)) {
        continue;
      }
      edited.add(call);
      const args = call.arguments.slice(1);
      const symbol = this.plan.symbols.get(site);
      if (!symbol) {
        // A handler that nothing in the browser can reach is the function alone.
        this.patch.replace(call.start, fn.start, '(');
        this.patch.replace(fn.end, call.end, ')');
        continue;
      }
      const ref = JSON.stringify(`${this.plan.id}#${symbol}`);
      const scope = this.scopeVar(instanceScope(this.plan, site.scope));
      this.patch.replace(call.start, fn.start, `${this.helper('fn')}(`);
      if (args.length === 0) {
        this.patch.replace(fn.end, call.end, `, ${ref}, ${scope})`);
      } else {
        this.patch.replace(fn.end, args[0]!.start, `, ${ref}, ${scope}, [`);
        this.patch.replace(args.at(-1)!.end, call.end, '])');
      }
    }
  }

  /**
   * `$bind(name)` passes the child the value of the name with its slot,
   * `binding(name, scope, slot)`, so the child's writes reach it.
   */
  private addBindEdits(): void {
    let edited = handlerEdits.get(this.patch);
    if (!edited) {
      handlerEdits.set(this.patch, (edited = new Set()));
    }
    for (const { call, declaration, setter } of this.plan.graph.model.bindings) {
      const [target, fn] = call.arguments;
      if (!target || edited.has(call)) {
        continue;
      }
      edited.add(call);
      const scope = this.scopeVar(instanceScope(this.plan, declaration.scope));
      const slot = slotIndex(this.plan, declaration);
      this.patch.replace(call.start, target.start, '$$b.binding((');
      const symbol = setter && this.plan.symbols.get(setter);
      if (!fn || !setter || !symbol) {
        this.patch.replace(target.end, call.end, `), ${scope}, ${slot})`);
        continue;
      }
      // The setter loads with its own part, as a handler of `$handler` does.
      const ref = JSON.stringify(`${this.plan.id}#${symbol}`);
      const owner = this.scopeVar(instanceScope(this.plan, setter.scope));
      this.patch.replace(target.end, fn.start, `), ${scope}, ${slot}, ${this.helper('fn')}(`);
      this.patch.replace(fn.end, call.end, `, ${ref}, ${owner}))`);
    }
  }

  // Output

  line(code: string): void {
    this.flush();
    this.push(`${'  '.repeat(this.depth)}${code}`);
    if (code.endsWith('{')) {
      this.depth++;
      const trimmed = code.trim();
      if (trimmed === '{') {
        this.plainBraces.add(this.lines.length - 1);
      }
      if (trimmed === '{') {
        this.braces.push({ kind: 'plain' });
      } else if (/=> \{$|^(?:export )?(?:default )?function\b/.test(trimmed)) {
        this.braces.push({ kind: 'fn', fn: this.fnCount++ });
      } else {
        this.braces.push({ kind: 'control' });
      }
    }
  }

  close(code = '}'): void {
    this.flush();
    this.depth--;
    if (this.braces.pop()?.kind === 'plain' && code === '}') {
      this.plainBraces.add(this.lines.length);
    }
    this.push(`${'  '.repeat(this.depth)}${code}`);
    if (code.endsWith('{')) {
      this.depth++;
      this.braces.push({ kind: 'control' });
    }
  }

  /**
   * The return of a render function of the browser: its clone, its HTML, or an empty string
   * for a function with no markup, which is not HTML that the core must parse.
   */
  returnLine(fn: number, cloned: boolean): string {
    if (cloned) {
      return 'return $$f;';
    }
    let markup = false;
    for (const flush of this.flushes) {
      if (this.levels[flush.line]!.fn === fn) {
        markup = true;
        break;
      }
    }
    return markup ? 'return $$html;' : "return '';";
  }

  /** The number of the function that the next line is in, or -1. */
  get currentFn(): number {
    for (let i = this.braces.length - 1; i >= 0; i--) {
      const brace = this.braces[i]!;
      if (brace.kind === 'fn') {
        return brace.fn ?? -1;
      }
    }
    return -1;
  }

  /** Adds a line, with where it is. */
  private push(line: string): void {
    this.lines.push(line);
    // The innermost function brace, and whether a control brace sits inside it.
    let at = -1;
    let control = false;
    for (let i = this.braces.length - 1; i >= 0; i--) {
      const kind = this.braces[i]!.kind;
      if (kind === 'fn') {
        at = i;
        break;
      }
      if (kind === 'control') {
        control = true;
      }
    }
    this.levels.push({
      fn: at === -1 ? -1 : this.braces[at]!.fn!,
      control,
    });
  }

  /** Copies source code, keeping the indentation of its lines relative to the first. */
  raw(code: string, offset: number): void {
    this.flush();
    const lineStart = this.file.source.lastIndexOf('\n', offset - 1) + 1;
    const column = offset - lineStart;
    const indent = '  '.repeat(this.depth);
    for (const [index, line] of code.split('\n').entries()) {
      const text = index === 0 ? line : line.replace(new RegExp(`^ {0,${column}}`), '');
      this.push(unmarked(text).trim() === '' ? '' : `${indent}${text}`);
    }
  }

  private html(text: string): void {
    const last = this.parts.at(-1);
    if (last && 'static' in last) {
      last.static += text;
    } else {
      this.parts.push({ static: text });
    }
  }

  private code(code: string, settled?: Settled): void {
    this.parts.push(settled ? { code, settled } : { code });
  }

  /**
   * In the browser, the memos that a value of the markup reads that never change and can be a
   * promise. No update writes the value when they settle, so the clone writes it again.
   */
  private settledMemos(expression: Expression, scope: Scope): Settled | undefined {
    const site = this.options.mode === 'client' ? this.sitesByNode.get(expression.ast) : undefined;
    if (!site || this.liveSites.has(site)) {
      return undefined;
    }
    const names: string[] = [];
    for (const reference of site.reads) {
      const declaration = reference.declaration;
      if (
        (declaration.kind === 'memo' || declaration.kind === 'async-memo') &&
        !reference.inFunction &&
        !(declaration.site && isPrimitive(declaration.site.node)) &&
        !names.includes(declaration.name)
      ) {
        names.push(declaration.name);
      }
    }
    return names.length > 0
      ? { names, scope: this.scopeVar(instanceScope(this.plan, scope)) }
      : undefined;
  }

  flush(): void {
    if (this.parts.length === 0) {
      return;
    }
    const parts = this.parts;
    this.parts = [];
    this.flushes.push({ line: this.lines.length, parts });
    const pieces: string[] = [];
    for (const part of parts) {
      pieces.push('static' in part ? JSON.stringify(part.static) : part.code);
    }
    const value = pieces.join(' + ');
    this.push(`${'  '.repeat(this.depth)}$$html += ${value};`);
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
    if (!outer) {
      return true;
    }
    for (const item of outer.inside) {
      if (isWithin(scope, item)) {
        return true;
      }
    }
    return false;
  }

  private anchor(scope: Scope, target: object): { scope: string; index: number } | undefined {
    const index = this.plan.anchors.get(target as Markup);
    if (index === undefined) {
      return undefined;
    }
    // A scope that a client render does not create is an instance, such as the scope that
    // children were written in, and an anchor names its ID.
    const name = this.scopeVar(scope);
    return { scope: this.isInside(scope) ? name : `${name}.id`, index };
  }

  /** Creates the instance of a body scope. */
  private createScope(scope: Scope): void {
    const parent = instanceScope(this.plan, scope.parent!);
    this.line(
      `const ${this.scopeVar(scope)} = ${this.helper('scope')}(${scope.id}, ${this.scopeVar(parent)});`,
    );
  }

  /** On the server, records the bound props before the markup, for `refKey`. */
  private emitBound(scope: Scope): void {
    if (this.options.mode !== 'server') {
      return;
    }
    const bindable = this.bindableProps(scope);
    if (bindable.length > 0) {
      this.line(`$$ctx.bound(${this.scopeVar(scope)}, $$props, { ${bindable.join(', ')} });`);
    }
  }

  /** The props that the component writes, as `"key": slot` entries. */
  private bindableProps(scope: Scope): string[] {
    const bindable: string[] = [];
    const slots = this.plan.scopes.get(scope)?.slots ?? [];
    for (const [index, slot] of slots.entries()) {
      if (slot.kind === 'prop' && slot.writable && slot.propKey !== undefined) {
        bindable.push(`${JSON.stringify(slot.propKey)}: ${index}`);
      }
    }
    return bindable;
  }

  emitSlots(scope: Scope): void {
    const slots = this.plan.scopes.get(scope)?.slots ?? [];
    if (slots.length > 0) {
      // A memo that the render did not wait for is in the state as its value when it is ready,
      // such as one that a `#loading` body rendered in place, and as a promise while it loads.
      const values: string[] = [];
      const slotNames: string[] = [];
      for (const slot of slots) {
        values.push(this.isPromise(slot) ? `$$b.stateValue(${promiseName(slot.name)})` : slot.name);
        slotNames.push(slot.name);
      }
      // The server also passes the names, so an error can say which value cannot be sent.
      const names = this.options.mode === 'server' ? `, ${JSON.stringify(slotNames)}` : '';
      this.line(
        `${this.helper('slots')}(${this.scopeVar(scope)}, [${values.join(', ')}]${names});`,
      );
    }
    // The props that the component writes, which a parent can bind with `$bind`.
    if (scope.kind === 'component') {
      const bindable = this.bindableProps(scope);
      if (bindable.length > 0) {
        this.line(
          `${this.helper('bindings')}(${this.scopeVar(scope)}, $$props, { ${bindable.join(', ')} });`,
        );
      }
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

  /**
   * The memos of a statement that the server waits for where they are
   * declared. `awaited` is true when every one of them is declared with
   * `await $memo(…)`. Such statements in a row form a run: every memo of
   * the run starts, and the render waits for all of them where the run
   * ends, so independent memos load at the same time. A memo that the
   * markup makes the page wait for, without the keyword, is awaited on its
   * own, as the code reads.
   */
  private blockingDeclarations(
    statement: oxc.Node,
  ): { declarations: Declaration[]; awaited: boolean } | undefined {
    if (this.options.mode !== 'server' || statement.type !== 'VariableDeclaration') {
      return undefined;
    }
    const declarations: Declaration[] = [];
    let awaited = true;
    for (const declarator of statement.declarations) {
      let init = declarator.init;
      if (init?.type === 'AwaitExpression') {
        init = init.argument;
      }
      const argument = init?.type === 'CallExpression' ? init.arguments[0] : undefined;
      const declaration = argument && this.sitesByNode.get(argument)?.declaration;
      if (!declaration || !isMemo(declaration) || !this.blocking.has(declaration)) {
        awaited = false;
        continue;
      }
      awaited &&= declaration.awaited === true;
      if (!this.inline.has(declaration)) {
        declarations.push(declaration);
      }
    }
    return declarations.length === 0 ? undefined : { declarations, awaited };
  }

  /**
   * Waits for a memo that the markup reads, and keeps its error for the read: the markup reads
   * the memo in place, so the `#try` around the read gets the error. A `#loading` or `#defer`
   * body waits for the memos that only it reads the same way.
   */
  private awaitHeld(declaration: Declaration): void {
    this.line(`let ${declaration.name};`);
    this.line(`try { ${declaration.name} = ${this.memoValue(declaration.name)}; } catch {}`);
  }

  /** Waits for the memos of a run of declarations, and gives each its value. */
  private awaitRun(run: Declaration[]): void {
    if (run.length === 1) {
      const [declaration] = run as [Declaration];
      this.line(`const ${declaration.name} = ${this.memoValue(declaration.name)};`);
      return;
    }
    const names: string[] = [];
    for (const declaration of run) {
      names.push(promiseName(declaration.name));
    }
    this.line(`if (($$t = $$b.waitAll([${names.join(', ')}])) !== undefined) await $$t;`);
    for (const declaration of run) {
      this.line(`const ${declaration.name} = $$b.read(${promiseName(declaration.name)});`);
    }
  }

  emitStatements(statements: oxc.Node[], scope: Scope): void {
    let run: Declaration[] = [];
    const endRun = (): void => {
      if (run.length > 0) {
        this.awaitRun(run);
        run = [];
      }
    };
    for (const statement of statements) {
      const blocking = this.blockingDeclarations(statement);
      if (blocking?.awaited) {
        this.raw(this.patch.slice(statement.start, statement.end), statement.start);
        run.push(...blocking.declarations);
        continue;
      }
      endRun();
      if (blocking) {
        this.raw(this.patch.slice(statement.start, statement.end), statement.start);
        for (const declaration of blocking.declarations) {
          this.awaitHeld(declaration);
        }
        continue;
      }
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
      if (this.options.mode === 'client' && statement.type === 'VariableDeclaration') {
        this.watchUnreadMemos(statement, scope);
      }
    }
    endRun();
  }

  /**
   * In the browser, a memo that nothing reads has no slot, so no load takes its promise. Its
   * rejection goes to the nearest `#try`, which is where a memo that throws sends its error. A
   * memo that always gives a primitive, such as `count * 2`, is never a promise. `await memo`
   * compiles to a plain read of the promise, which drops it, unless the read is the whole value
   * of another memo, as in `$memo(await memo)`, which then holds the same promise.
   */
  private watchUnreadMemos(statement: oxc.VariableDeclaration, scope: Scope): void {
    for (const declarator of statement.declarations) {
      const declaration =
        declarator.id.type === 'Identifier'
          ? scope.declarations.get(declarator.id.name)
          : undefined;
      if (
        declaration &&
        (declaration.kind === 'memo' || declaration.kind === 'async-memo') &&
        declaration.reads.every(
          (read) =>
            read.await &&
            (read.site.kind !== 'memo' ||
              read.site.node.start !== read.await.start ||
              read.site.node.end !== read.await.end),
        ) &&
        slotIndex(this.plan, declaration) === -1 &&
        !(declaration.site && isPrimitive(declaration.site.node))
      ) {
        const target = this.scopeVar(instanceScope(this.plan, scope));
        this.line(`$$b.unreadMemo(${target}, ${declaration.name});`);
      }
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
    let special = false;
    for (const declarator of statement.declarations) {
      if (specialCall(declarator)) {
        special = true;
        break;
      }
    }
    if (!special) {
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
      if (call === '$isPassed' && declaration?.passedKey !== undefined) {
        // The props as the caller passed them, before defaults apply.
        this.line(
          `const ${declaration.name} = ${JSON.stringify(declaration.passedKey)} in $$props;`,
        );
        continue;
      }
      let context: string | undefined;
      if (call && BUILT_IN_CONTEXTS[call]) {
        context = BUILT_IN_CONTEXTS[call];
      } else if (call === '$getContext' && init.arguments[0]) {
        context = this.source(init.arguments[0]);
      }
      if (!context || declarator.id.type !== 'Identifier') {
        this.line(`${statement.kind} ${this.source(declarator)};`);
        continue;
      }
      const slot = declaration ? slotIndex(this.plan, declaration) : -1;
      // The slot is recorded, so a change to the provided value reaches it on the client.
      const record = slot === -1 ? '' : `, ${slot}`;
      this.line(
        `const ${declarator.id.name} = ${this.helper('consume')}(${context}, ${target}${record});`,
      );
    }
    return true;
  }

  private isServerStatement(statement: oxc.Node): boolean {
    const nodes: (oxc.Node | null | undefined)[] = [];
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        nodes.push(declarator.init);
      }
    } else {
      nodes.push(statement);
    }
    for (const node of nodes) {
      if (!node || this.sitesByNode.get(node)?.kind !== 'server-function') {
        return false;
      }
    }
    return true;
  }

  private isFunctionStatement(statement: oxc.Node): boolean {
    if (statement.type === 'FunctionDeclaration') {
      return true;
    }
    if (statement.type !== 'VariableDeclaration') {
      return false;
    }
    for (const declarator of statement.declarations) {
      const init = declarator.init;
      if (init?.type !== 'ArrowFunctionExpression' && init?.type !== 'FunctionExpression') {
        return false;
      }
    }
    return true;
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
        `:${anchor.index}" b-client="${site.trigger}=${this.plan.id}#${this.plan.symbols.get(site)}"`,
      );
      // A callback that reads an element of this scope through `ref` runs when that element
      // comes into view, instead of the first element of the scope.
      const near = site.trigger === 'visible' ? this.refElement(site, scope) : undefined;
      if (near !== undefined) {
        this.html(' b-near="');
        this.code(anchor.scope);
        this.html(`:${near}"`);
      } else if (site.trigger === 'visible' && this.options.mode === 'server') {
        // A signal that a component gets with `ref=$bind(name)` waits for the element it forwards.
        const forwarded = this.forwardedSignal(site, scope);
        if (forwarded) {
          this.code(`$$ctx.near(${anchor.scope}, ${slotIndex(this.plan, forwarded)})`);
        }
      }
      this.html('></template>');
    }
  }

  /** The code of the `b-r` attribute of an element that has `ref=$bind(name)` with a prop. */
  private forwardedRef(node: ElementNode): string | undefined {
    if (this.options.mode !== 'server') {
      return undefined;
    }
    for (const attribute of node.attributes) {
      const declaration = attribute.kind === 'ref' ? this.refTargets.get(attribute) : undefined;
      if (declaration?.kind === 'prop') {
        const scope = this.scopeVar(instanceScope(this.plan, declaration.scope));
        return `$$ctx.refKey(${scope}, ${slotIndex(this.plan, declaration)})`;
      }
    }
    return undefined;
  }

  /** The signal of `scope` that a site reads, which a component may forward its element to. */
  private forwardedSignal(site: Site, scope: Scope): Declaration | undefined {
    for (const read of site.reads) {
      const declaration = read.declaration;
      if (declaration.scope !== scope || declaration.kind !== 'signal') {
        continue;
      }
      for (const binding of this.plan.graph.model.bindings) {
        if (binding.declaration === declaration && !binding.setter) {
          return declaration;
        }
      }
    }
    return undefined;
  }

  /** The anchor of the first element of `scope` that a site reads through `ref`. */
  private refElement(site: Site, scope: Scope): number | undefined {
    for (const read of site.reads) {
      for (const ref of read.declaration.refs) {
        const index = ref.scope === scope ? this.plan.anchors.get(ref.element) : undefined;
        if (index !== undefined) {
          return index;
        }
      }
    }
    return undefined;
  }

  /** Emits the content of the component, without creating its scope. */
  emitComponentContent(setup: oxc.Node[]): void {
    const component = this.plan.graph.model.component;
    if (this.plan.styles.css) {
      // The stylesheet is written once per page, before the first instance. The browser adds it
      // to the head, so it is not in the markup.
      if (this.options.mode === 'client') {
        this.line(`${this.helper('style')}(${JSON.stringify(this.plan.id)}, $$css);`);
      } else {
        this.code(`${this.helper('style')}(${JSON.stringify(this.plan.id)}, $$css)`);
      }
    }
    this.emitStatements(setup, component);
    this.emitBound(component);
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
        // A value that reads a prop can be children, or a template that a prop holds, such as
        // `{item(label)}`, which render where they are inserted too.
        const readsProp = readsProps(this.sitesByNode.get(node.expression.ast));
        // Children in a table body or a list get the tag of the spacers of a windowed list in them.
        const spacer = this.parentSpacer();
        // On the server, children also get the anchor of the insert, so the browser knows that
        // the server rendered them here.
        const server = this.options.mode === 'server' && readsProp;
        let rest = server && spacer !== undefined ? `, ${JSON.stringify(spacer)}` : '';
        if (server && anchor) {
          rest = `${rest || ', undefined'}, ${anchor.index}`;
        }
        const at =
          this.options.mode === 'server' || readsProp
            ? `, ${this.ctxArgument}, ${this.scopeVar(instanceScope(this.plan, scope))}${rest}`
            : '';
        // A primitive renders as text, so it needs neither the place of the insert nor an await.
        const value = this.isPrimitiveInsert(node.expression)
          ? `$$b.insert(${this.expression(node.expression)})`
          : this.ready(`$$b.insert(${this.expression(node.expression)}${at})`);
        // A literal renders when the component compiles.
        const text = literalText(node.expression.ast);
        const settled = this.settledMemos(node.expression, scope);
        const emitValue = (): void =>
          text === undefined ? this.code(value, settled) : this.html(text);
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
        // `#reveal` orders the `#loading` bodies that stream from the server. Markup that the
        // browser renders has no stream, so its children render as they are.
        if (node.reveal && this.options.mode === 'server') {
          this.line(
            `$$ctx.revealStart(${JSON.stringify(node.reveal.order)}, ${node.reveal.collapsed});`,
          );
          this.emitNodes(node.children, scope);
          this.line('$$ctx.revealEnd();');
          return;
        }
        this.emitNodes(node.children, scope);
        return;
      case 'listener': {
        const anchor = this.anchor(scope, node)!;
        const events: string[] = [];
        for (const attribute of node.attributes) {
          events.push(this.eventEntry(attribute));
        }
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

  /**
   * The `b-on` entry of `value=$bind(name)` or `checked=$bind(name)` on an
   * element: `input=$bind#<hops>.<slot>`, where `hops` counts the parents
   * from the scope of the element to the scope of the name. The core writes
   * the slot from the element without loading any code of the component.
   */
  private bindEntry(
    node: ElementNode,
    attribute: ValueAttribute,
    scope: Scope,
  ): string | undefined {
    let value: oxc.Node = attribute.value.ast;
    while (value.type === 'ParenthesizedExpression') {
      value = value.expression;
    }
    let binding: (typeof this.plan.graph.model.bindings)[number] | undefined;
    for (const item of this.plan.graph.model.bindings) {
      if (item.call === value) {
        binding = item;
        break;
      }
    }
    if (!binding) {
      return undefined;
    }
    const setter = binding.setter && this.plan.symbols.get(binding.setter);
    const path = scopePath(
      this.plan,
      '$$s',
      instanceScope(this.plan, scope),
      instanceScope(this.plan, binding.declaration.scope),
    );
    const hops = path.split('.p').length - 1;
    let type: { value: string | true } | undefined;
    for (const item of node.attributes) {
      if (item.kind === 'static' && item.name === 'type') {
        type = item;
        break;
      }
    }
    const box = type && typeof type.value === 'string' && /^(checkbox|radio)$/i.test(type.value);
    // A box and a select change at once. A text field writes as the user types.
    const event =
      attribute.name === 'checked' || box || node.tag.toLowerCase() === 'select'
        ? 'change'
        : 'input';
    // `$bind(name, fn)` calls the setter with the value of the element.
    if (setter) {
      return `${event}=$set:${this.plan.id}#${setter}`;
    }
    return `${event}=$bind#${hops}.${slotIndex(this.plan, binding.declaration)}`;
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
    when?: string,
  ): void {
    const declaration = this.refTargets.get(attribute);
    const element = `${this.helper('element')}(${anchor.scope}, ${anchor.index})`;
    const outer = this.options.outer;
    const guard = when ? `if (${when}) ` : '';
    if (declaration && outer && !this.isInside(declaration.scope)) {
      // The signal belongs to a scope outside this render, so it is written after the element is in the page.
      const path = scopePath(this.plan, outer.baseVar, outer.base, declaration.scope);
      this.line(
        `${this.helper('after')}.push(() => { ${guard}$$b.set(${path}, ${slotIndex(this.plan, declaration)}, ${element}); });`,
      );
    } else {
      this.line(`${guard}${target} = ${element};`);
    }
  }

  /**
   * What `ref` passes a component, as `$bind(name)` does: the value of the name with its slot, so
   * the writes of the component reach it.
   */
  private getBinding(declaration: Declaration): string {
    const outer = this.options.outer;
    const slot = slotIndex(this.plan, declaration);
    if (outer && !this.isInside(declaration.scope)) {
      const path = scopePath(this.plan, outer.baseVar, outer.base, declaration.scope);
      return `$$b.binding($$b.get(${path}, ${slot}), ${path}, ${slot})`;
    }
    const scope = this.scopeVar(instanceScope(this.plan, declaration.scope));
    return `$$b.binding(${declaration.name}, ${scope}, ${slot})`;
  }

  /**
   * The style attribute of a top-level element, with the style variables of
   * the component, so the elements inside inherit them. An element with
   * spreads gets them after its attributes merge, so it returns them as code,
   * and the style of a spread does not take the place of the variables.
   */
  private emitVariables(node: ElementNode): string | undefined {
    const { variables } = this.plan.styles;
    if (variables.length === 0 || this.nesting > 0) {
      return undefined;
    }
    const values = this.variableValues();
    if (hasSpread(node.attributes)) {
      this.emitLiveStyles();
      return values;
    }
    const own = findStyleAttribute(node.attributes);
    let existing = 'undefined';
    if (own?.kind === 'static') {
      existing = own.value === true ? 'undefined' : JSON.stringify(own.value);
    } else if (own?.kind === 'value') {
      existing = this.expression(own.value);
    }
    this.code(`$$b.attribute("style", $$b.vars(${values}, ${existing}))`);
    this.emitLiveStyles();
    return values;
  }

  /** The style variables of the component and their values, as an object in code. */
  private variableValues(): string {
    const values: string[] = [];
    for (const variable of this.plan.styles.variables) {
      values.push(
        `${JSON.stringify(variable.name)}: ${variableValue(variable, this.expression(variable.expression))}`,
      );
    }
    return `{ ${values.join(', ')} }`;
  }

  private emitLiveStyles(): void {
    if (this.plan.liveStyles) {
      // Marks the element, so changes to the variables reach it.
      this.html(' b-v="');
      this.code(this.scopeVar(this.plan.graph.model.component));
      this.html('"');
    }
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
    const method = FORM_METHODS.get(name);
    if (!method || value.ast.type !== 'Identifier') {
      return undefined;
    }
    const declaration = lookup(scope, value.ast.name);
    // A server function of the component, or one that it imports from a `'use server'` file.
    if (declaration?.kind !== 'server-function' && declaration?.serverImport === undefined) {
      return undefined;
    }
    const ref = JSON.stringify(
      declaration.serverImport ?? serverFunctionId(this.plan, declaration.name),
    );
    // The form posts, unless the element sets its own method.
    let hasMethod = false;
    for (const attribute of node.attributes) {
      if ('name' in attribute && attribute.name === method) {
        hasMethod = true;
        break;
      }
    }
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
    let declaration: Declaration | undefined;
    for (const item of this.plan.graph.model.declarations) {
      if (item.kind === 'action' && item.action === fn.name) {
        declaration = item;
        break;
      }
    }
    const slot = declaration ? slotIndex(this.plan, declaration) : -1;
    if (!declaration || slot === -1) {
      return undefined;
    }
    return `\`\${${this.scopeVar(instanceScope(this.plan, declaration.scope))}}:${slot}\``;
  }

  private emitElement(node: ElementNode, scope: Scope): void {
    // A `<title>` in `#head` sets the title of the page. The core sets it from the last one in
    // the page, so a block that renders one decides the title. The plan reports the others.
    const pageTitle = node.tag === 'title' && this.headBlocks > 0;
    if (pageTitle && this.options.mode === 'server') {
      this.line(`${this.helper('title')}(${this.titleText(node)}, true);`);
    }
    // A spread can pass on handlers, such as the `onClick` of `...rest`, on the server and in
    // markup that the browser renders.
    let spreadHandlers: string | undefined;
    if (hasSpread(node.attributes)) {
      spreadHandlers = this.unique('on');
      this.line(`const ${spreadHandlers}: string[] = [];`);
    }
    this.html(`<${node.tag}`);
    if (this.hasScope(node.tag, staticClasses(node.attributes))) {
      this.html(` ${this.plan.styles.attribute}`);
    }
    const anchor = this.anchor(scope, node);
    // With a spread, the element writes its own `b-b` before it. `spread` in html.ts still writes
    // the inherited `b-b` on purpose, for a component with no anchor of its own. The parser keeps
    // the first, so the element's own wins.
    if (anchor && spreadHandlers) {
      this.html(' b-b="');
      this.code(anchor.scope);
      this.html(`:${anchor.index}"`);
    }
    const variables = this.emitVariables(node);
    const events: string[] = [];
    // With spreads, the attributes are one object in their order, so a name is written once:
    // a later value wins, and classes add up.
    const merged = hasSpread(node.attributes) ? ([] as string[]) : undefined;
    // A spread that changes in the browser names the attributes that it wrote, so its first
    // update there removes only those, and keeps attributes that other code set.
    let liveSpread = false;
    for (const attribute of node.attributes) {
      const site =
        attribute.kind === 'spread' ? this.sitesByNode.get(attribute.value.ast) : undefined;
      if (site !== undefined && this.plan.clientSites.has(site)) {
        liveSpread = true;
        break;
      }
    }
    function spreadArguments(handlers: string | undefined): string {
      if (liveSpread) {
        return `, ${handlers ?? 'undefined'}, true`;
      }
      return handlers ? `, ${handlers}` : '';
    }
    for (const attribute of node.attributes) {
      if (
        variables &&
        !merged &&
        (attribute.kind === 'static' || attribute.kind === 'value') &&
        attribute.name === 'style'
      ) {
        continue;
      }
      if (merged && this.mergedAttribute(node, attribute, scope, merged)) {
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
            this.settledMemos(attribute.value, scope),
          );
          // `value=$bind(name)` writes the name back as the element changes, before the element's
          // own handlers run.
          const bound = this.bindEntry(node, attribute, scope);
          if (bound) {
            events.unshift(bound);
          }
          break;
        }
        case 'spread':
          this.code(
            `$$b.spread(${this.expression(attribute.value)}${spreadArguments(spreadHandlers)})`,
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
      }
    }
    if (merged) {
      // A `ref` that a rest prop holds is a binding of the parent's signal. The element goes to it.
      const forwards = anchor !== undefined && this.spreadsRest(node.attributes);
      const attributes = `$$b.mergeAttributes([${merged.join(', ')}]${variables ? `, ${variables}` : ''})`;
      this.code(
        `$$b.spread(${forwards ? `${this.helper('restRef')}(${attributes}, ${anchor.scope}, ${anchor.index})` : attributes}${spreadArguments(spreadHandlers)})`,
      );
    }
    // With a spread, the own `b-b` is already written, before it.
    if (anchor && !spreadHandlers) {
      this.html(' b-b="');
      this.code(anchor.scope);
      this.html(`:${anchor.index}"`);
    }
    // An element that forwards a `ref` prop tells the loader which signal of the caller it is, so a
    // `$client` of the caller can wait for it.
    const forwarded = this.forwardedRef(node);
    if (forwarded) {
      this.code(forwarded);
    }
    if (pageTitle) {
      this.html(' b-t');
    }
    if (spreadHandlers) {
      // One `b-on` for the handlers of the element and those that its spreads pass on.
      this.code(`$$b.onAttribute(${spreadHandlers}, ${JSON.stringify(events.join(' '))})`);
    } else if (events.length > 0) {
      this.html(` b-on="${events.join(' ')}"`);
    }
    this.html('>');
    if (VOID_ELEMENTS.has(node.tag)) {
      return;
    }
    this.nesting++;
    this.elements.push(node.tag.toLowerCase());
    this.emitNodes(node.children, scope);
    this.elements.pop();
    this.nesting--;
    this.html(`</${node.tag}>`);
  }

  /** True when no `ref` is written, and a spread reads the props of the component. */
  private spreadsRest(attributes: Attribute[]): boolean {
    let spreadsProps = false;
    for (const attribute of attributes) {
      if (attribute.kind === 'ref') {
        return false;
      }
      if (attribute.kind === 'spread' && readsProps(this.sitesByNode.get(attribute.value.ast))) {
        spreadsProps = true;
      }
    }
    return spreadsProps;
  }

  /**
   * Adds an attribute of an element with spreads to `parts`, the objects
   * that its spread merges. Returns false for an attribute that stays apart,
   * such as a handler or a `ref`.
   */
  private mergedAttribute(
    node: ElementNode,
    attribute: Attribute,
    scope: Scope,
    parts: string[],
  ): boolean {
    switch (attribute.kind) {
      case 'static':
        parts.push(
          // An attribute without a value is empty, as HTML reads it, so `aria-hidden` stays empty.
          `{ ${JSON.stringify(attribute.name)}: ${attribute.value === true ? "''" : JSON.stringify(decodeAttribute(attribute.value))} }`,
        );
        return true;
      case 'value':
        if (this.formAction(node, attribute.name, attribute.value, scope)) {
          return false;
        }
        parts.push(`{ ${JSON.stringify(attribute.name)}: ${this.expression(attribute.value)} }`);
        return true;
      case 'computed':
        parts.push(
          `{ [${this.expression(attribute.name)}]: ${attribute.value === true ? 'true' : this.expression(attribute.value)} }`,
        );
        return true;
      case 'spread':
        parts.push(this.expression(attribute.value));
        return true;
      default:
        return false;
    }
  }

  /**
   * The text of a `<title>`, as code: its one insert, or its text and the
   * inserts in it joined, such as `Items ({count})`.
   */
  private titleText(node: ElementNode): string {
    const [only] = node.children;
    if (only?.kind === 'insert' && node.children.length === 1) {
      return this.expression(only.expression);
    }
    const parts: string[] = [];
    for (const child of node.children) {
      if (child.kind === 'insert') {
        parts.push(`(${this.expression(child.expression)} ?? '')`);
      } else if (child.kind === 'text') {
        parts.push(JSON.stringify(decodeText(cleanText(child.value))));
      }
    }
    return parts.length === 0 ? '""' : parts.join(' + ');
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
    function piece(part: ClassPart): string {
      const text = JSON.stringify(` ${escapeClass(part.name)}`);
      return part.condition === undefined ? text : `((${part.condition}) ? ${text} : "")`;
    }
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
      const pieces: string[] = [];
      for (const part of classes) {
        pieces.push(piece(part));
      }
      this.code(`$$b.classAttribute(${pieces.join(' + ')})`);
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

  /** Renders the children of a component or a dynamic tag, for their export in the browser. */
  emitChildrenBody(node: ComponentNode | DynamicTagNode, scope: Scope): void {
    this.atTopLevel(() => this.emitNodes(node.children, scope));
  }

  /** Runs a callback for markup that renders outside this component's elements, such as children. */
  private atTopLevel(callback: () => void): void {
    const nesting = this.nesting;
    // The elements around markup that renders elsewhere are not these.
    const elements = this.elements.splice(0);
    this.nesting = 0;
    callback();
    this.nesting = nesting;
    this.elements.push(...elements);
  }

  /** Renders children into a variable, for a component or a dynamic tag. */
  private emitChildren(node: ComponentNode | DynamicTagNode, scope: Scope): string | undefined {
    const nodes = node.children;
    if (nodes.length === 0) {
      return undefined;
    }
    const name = this.unique('children');
    if (this.options.mode === 'server') {
      // The children render where the component inserts them, so they read its contexts. The
      // browser renders them with their own export each time the component inserts them again.
      const render = this.plan.childrenRenders.get(node);
      const ref = render ? `, ${JSON.stringify(`${this.plan.id}#${render.symbol}`)}` : '';
      this.line(
        `const ${name} = $$b.children(${this.scopeVar(instanceScope(this.plan, scope))}, async ($$ctx) => {`,
      );
      this.line(`let $$html = '';`);
      this.atTopLevel(() => this.emitNodes(nodes, scope));
      this.flush();
      this.line('return $$html;');
      this.close(`}${ref});`);
      return name;
    }
    this.line(
      `const ${name} = $$b.children(${this.scopeVar(instanceScope(this.plan, scope))}, () => {`,
    );
    const fn = this.currentFn;
    this.line(`let $$html = '';`);
    this.atTopLevel(() => this.emitNodes(nodes, scope));
    this.flush();
    // Children whose markup can clone give the clone, which the insert puts in place.
    const cloned = this.options.hoist !== undefined && cloneLines(this, this.options.hoist, fn);
    this.line(this.returnLine(fn, cloned));
    this.close('});');
    return name;
  }

  /**
   * The attributes of a dynamic tag. With a spread, they merge as the attributes of an element
   * do: a later one wins, and a `class` adds to the others, so a part that takes `as` keeps its
   * own class and the caller's.
   */
  private dynamicProps(attributes: Attribute[], scope: Scope, extra: string[]): string {
    if (!hasSpread(attributes)) {
      return this.props(attributes, scope, extra);
    }
    const parts: string[] = [];
    let run: Attribute[] = [];
    const flush = (): void => {
      if (run.length > 0) {
        parts.push(this.props(run, scope));
        run = [];
      }
    };
    for (const attribute of attributes) {
      if (attribute.kind === 'spread') {
        flush();
        parts.push(this.expression(attribute.value));
      } else {
        run.push(attribute);
      }
    }
    flush();
    if (extra.length > 0) {
      parts.push(`{ ${extra.join(', ')} }`);
    }
    return `$$b.mergeAttributes([${parts.join(', ')}])`;
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
    // The functions can be the values of keys of objects, or items of lists, inside the value too.
    const visit = (node: oxc.Node): string => {
      if (node.type === 'ArrayExpression') {
        let code = '';
        let position = node.start;
        for (const element of node.elements) {
          if (!element || element.type === 'SpreadElement') {
            continue;
          }
          const marked = nested(element) ? visit(element) : mark(element);
          if (!marked) {
            continue;
          }
          code += this.patch.slice(position, element.start) + marked;
          position = element.end;
        }
        return code + this.patch.slice(position, node.end);
      }
      if (node.type !== 'ObjectExpression') {
        return mark(node) ?? this.source(node);
      }
      let code = '';
      let position = node.start;
      for (const property of node.properties) {
        if (property.type !== 'Property' || property.computed) {
          continue;
        }
        const marked = nested(property.value)
          ? visit(property.value)
          : mark(property.value, property.method);
        if (!marked) {
          continue;
        }
        code += this.patch.slice(position, property.start);
        const key = this.patch.slice(property.key.start, property.key.end);
        code += `${key}: ${marked}`;
        position = property.end;
      }
      return code + this.patch.slice(position, node.end);
    };
    return visit(value);
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
    const childrenName = this.emitChildren(node, scope);
    const props = this.props(
      node.attributes,
      scope,
      childrenName ? [`children: ${childrenName}`] : [],
    );
    const anchor = this.anchor(scope, node);
    // The rendering scope becomes the owner of the child, so the child finds the contexts above it.
    const owner = this.scopeVar(instanceScope(this.plan, scope));
    let link = anchor ? `, ${anchor.index}` : '';
    if (this.inParagraph.has(node)) {
      // Where the component is, so the server can name it when its element closes the `<p>`.
      const before = this.file.source.slice(0, node.start).split('\n');
      const at = `${this.file.filename}:${before.length}:${before.at(-1)!.length + 1}`;
      link = `${link || ', undefined'}, ${JSON.stringify(`<${node.name}> in ${at}`)}`;
    }
    this.code(
      `${this.wait}$$b.component(${node.name}, ${props}, ${this.ctxArgument}, ${owner}${link})`,
    );
  }

  private emitDynamic(node: DynamicTagNode, scope: Scope): void {
    const childrenName = this.emitChildren(node, scope);
    const extra: string[] = [];
    if (this.hasScope(undefined, staticClasses(node.attributes))) {
      extra.push(`${JSON.stringify(this.plan.styles.attribute)}: $$b.internal(true)`);
    }
    const anchor = this.anchor(scope, node);
    if (anchor) {
      extra.push(`"b-b": $$b.internal(\`\${${anchor.scope}}:${anchor.index}\`)`);
    }
    const events: string[] = [];
    for (const attribute of node.attributes) {
      if (attribute.kind === 'event') {
        events.push(this.eventEntry(attribute));
      }
    }
    if (events.length > 0) {
      // The entries name the scope of the handlers, for a component that renders the element.
      const owner = instanceScope(this.plan, scope);
      const id = this.isInside(owner) ? this.scopeVar(owner) : `${this.scopeVar(owner)}.id`;
      const entries: string[] = [];
      for (const event of events) {
        entries.push(`${JSON.stringify(`${event}@`)} + ${id}`);
      }
      extra.push(`"b-on": $$b.internal(${entries.join(' + " " + ')})`);
    }
    let attributes: Attribute[] = [];
    for (const attribute of node.attributes) {
      if (attribute.kind !== 'event') {
        attributes.push(attribute);
      }
    }
    const { variables } = this.plan.styles;
    // With a spread, the style variables go on after the attributes merge, so the style of the
    // spread does not take their place.
    let spreadVariables: string | undefined;
    if (variables.length > 0 && this.nesting === 0) {
      if (this.plan.liveStyles) {
        extra.push(`"b-v": $$b.internal(${this.scopeVar(this.plan.graph.model.component)})`);
      }
    }
    if (variables.length > 0 && this.nesting === 0 && hasSpread(attributes)) {
      spreadVariables = this.variableValues();
    } else if (variables.length > 0 && this.nesting === 0) {
      // A top-level dynamic tag sets the style variables, as a top-level element does.
      const own = findStyleAttribute(attributes);
      let existing = 'undefined';
      if (own?.kind === 'static') {
        existing = own.value === true ? 'undefined' : JSON.stringify(own.value);
      } else if (own?.kind === 'value') {
        existing = this.expression(own.value);
      }
      const rest: Attribute[] = [];
      for (const attribute of attributes) {
        if (attribute !== own) {
          rest.push(attribute);
        }
      }
      attributes = rest;
      extra.push(`"style": $$b.vars(${this.variableValues()}, ${existing})`);
    }
    // A tag that names a component gets the binding of `ref` as its `ref` prop, and writes the
    // element itself. A tag that names an element writes the element here.
    const refs: (Attribute & { kind: 'ref' })[] = [];
    for (const attribute of node.attributes) {
      if (attribute.kind === 'ref') {
        refs.push(attribute);
      }
    }
    const tag = this.expression(node.tag);
    let tagName = tag;
    let binding = '';
    const forwards = anchor !== undefined && this.spreadsRest(node.attributes);
    if ((refs.length > 0 || forwards) && anchor) {
      // A plain name is read again where the element is written. The code of another tag
      // is read once, which keeps a block from cloning, so only such tags pay for it.
      if (!/^\([^\s()+\-*/?:,;'"`[\]{}!&|<>=]+\)$/.test(tag)) {
        tagName = this.unique('tag');
        this.line(`const ${tagName} = ${tag};`);
      }
      const declaration = this.refTargets.get(refs.at(-1)!);
      if (declaration) {
        binding = `, ${this.getBinding(declaration)}`;
      }
    }
    let props = spreadVariables
      ? `$$b.mergeAttributes([${this.dynamicProps(attributes, scope, extra)}], ${spreadVariables})`
      : this.dynamicProps(attributes, scope, extra);
    if (forwards && anchor) {
      // A `ref` in the rest props goes to the element, when the tag names one. A component
      // gets it as a prop and forwards it.
      props = `${this.helper('restRef')}(${props}, ${anchor.scope}, ${anchor.index}, ${tagName})`;
    }
    this.code(
      this.ready(
        `$$b.dynamic(${tagName}, ${props}, ${childrenName ?? 'undefined'}, ${this.ctxArgument}, ${this.scopeVar(instanceScope(this.plan, scope))}${binding})`,
      ),
    );
    // `ref` gets the element that the tag renders, when it names an element.
    for (const attribute of refs) {
      if (anchor) {
        this.emitRef(attribute.target, attribute, anchor, `typeof ${tagName} !== 'function'`);
      }
    }
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
    const fn = this.currentFn;
    this.line(`let $$html = '';`);
    this.createScope(body);
    this.html('<!--P');
    this.code(this.scopeVar(body));
    this.html('-->');
    this.headBlocks += block.kind === 'head' ? 1 : 0;
    this.atTopLevel(() => this.emitBody(block.body, false));
    this.headBlocks -= block.kind === 'head' ? 1 : 0;
    this.html('<!--/P-->');
    this.flush();
    // In the browser, the body clones its markup when it can.
    const cloned =
      this.options.mode === 'client' &&
      this.options.hoist !== undefined &&
      cloneLines(this, this.options.hoist, fn);
    this.line(cloned ? 'return $$f;' : 'return $$html;');
    this.close('})();');
    // `#head` content goes to the document's head, and portal content to the end of the page.
    this.line(`${this.helper(block.kind === 'head' ? 'head' : 'portal')}(${name});`);
  }

  /**
   * Renders a `#loading` block. When the memos that its body reads are
   * ready, and the body waits for nothing else, the body renders in place,
   * in the ID space of its boundary. Otherwise the fallback renders, and the
   * body renders after the rest of the page, so data that the body waits
   * for does not hold up the page. The memos that the body reads with
   * `await` are ready here, because the render around the block waited for
   * them.
   */
  private emitLoading(block: Block & { kind: 'loading' }, scope: Scope): void {
    const boundary = this.unique('boundary');
    const body = this.plan.bodyScopes.get(block.body)!;
    const memos: Declaration[] = [];
    const names: string[] = [];
    for (const declaration of awaitedMemos(this.plan, body, this.blocking)) {
      if (!this.inline.has(declaration)) {
        memos.push(declaration);
        names.push(promiseName(declaration.name));
      }
    }
    const inPlace = !mayWait(this.plan, block.body.children);
    if (inPlace && memos.length === 0) {
      // Nothing can hold the body up, so it always renders in place.
      this.line('$$ctx.enter();');
      this.emitBody(block.body);
      this.line('$$ctx.leave();');
      return;
    }
    this.line(`const ${boundary} = $$ctx.boundary();`);
    if (inPlace) {
      // A `#reveal` around the block, in this file or in a component that renders it, can hold a
      // body that is ready, so it shows in its turn.
      this.line(`if ($$b.settled([${names.join(', ')}]) && $$ctx.mayShow()) {`);
      this.line(`$$ctx.enter(${boundary});`);
      for (const declaration of memos) {
        this.line(`const ${declaration.name} = $$b.read(${promiseName(declaration.name)});`);
      }
      this.emitBody(block.body);
      this.line('$$ctx.leave();');
      this.close('} else {');
    }
    this.open(scope, block);
    this.html('<!--l');
    this.code(boundary);
    this.html('-->');
    if (block.fallback) {
      // `#reveal (collapsed)` holds the fallback in a template until the body before it shows.
      this.code(`$$ctx.fallbackStart(${boundary})`);
      this.line('{');
      this.emitBody(block.fallback);
      this.close();
      this.code(`$$ctx.fallbackEnd(${boundary})`);
    }
    this.html('<!--/l-->');
    this.end(block);
    this.line(`$$ctx.defer(${boundary}, async ($$ctx) => {`);
    this.line(`let $$html = '';`);
    for (const declaration of memos) {
      this.awaitHeld(declaration);
    }
    this.emitBody(block.body);
    this.flush();
    this.line('return $$html;');
    this.close('});');
    if (inPlace) {
      this.close();
    }
  }

  /**
   * Registers the `#catch` body of a `#try` on the server, and returns the name of the function
   * that ends the registration. The body renders again here for an error that comes after the
   * page is sent, in a context of its own.
   */
  private emitCatcher(block: Block & { kind: 'try' }, scope: Scope): string | undefined {
    // A `#try` that holds no `#loading` body and no component has nothing to catch later.
    const anchor = holdsStream(block) ? this.anchor(scope, block) : undefined;
    if (!anchor) {
      return undefined;
    }
    const end = this.unique('end');
    const raised = this.unique('raised');
    this.line(
      `const ${end} = $$ctx.catcher(${anchor.scope} + ${JSON.stringify(`:${anchor.index}`)}, async ($$ctx, ${raised}) => {`,
    );
    this.line(`let $$html = '';`);
    if (block.error) {
      this.line(`const ${block.error.name} = $$b.caught(${raised}, $$ctx);`);
    }
    if (block.reset) {
      this.line(`const ${block.reset.name} = undefined;`);
    }
    this.emitBody(block.fallback);
    this.flush();
    this.line('return $$html;');
    this.close('});');
    return end;
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
      this.awaitHeld(declaration);
    }
    this.emitBody(block.body);
    this.flush();
    this.line('return $$html;');
    this.close('});');
  }

  /**
   * Writes the markers of a nested `#if` or `#for` of a clone, with nothing between them, and
   * the call that fills the block after the clone. Returns false for a block that renders inline.
   */
  private emitFill(block: Block, scope: Scope): boolean {
    // A block in the function of children renders there, which the calls of a clone do not fill.
    // A windowed list renders its first items inline.
    const windowed = block.kind === 'for' && block.window !== undefined;
    const fill = this.currentFn === 0 && !windowed ? this.options.fills?.(block) : undefined;
    const anchor = fill && this.anchor(scope, block);
    if (!fill || !anchor) {
      return false;
    }
    let call: string;
    if (fill.kind === 'if' && block.kind === 'if') {
      // The index of the branch that shows, or of the fallback, or -1.
      let index = block.fallback ? String(block.branches.length) : '-1';
      for (let at = block.branches.length - 1; at >= 0; at--) {
        index = `${this.expression(block.branches[at]!.condition)} ? ${at} : ${index}`;
      }
      call = `$$b.fillBranch($$m, ${anchor.scope}, ${anchor.index}, ${index}, [${fill.renders.join(', ')}])`;
    } else if (fill.kind === 'for' && block.kind === 'for') {
      call = `$$b.fillList($$m, ${anchor.scope}, ${anchor.index}, $$b.toList(${this.expression(block.list)}), ${fill.render})`;
    } else {
      return false;
    }
    this.open(scope, block, fill.kind === 'if' ? '-1' : undefined);
    this.end(block);
    this.fills.set(`${anchor.scope}:${anchor.index}`, call);
    return true;
  }

  /**
   * Emits a function that renders a body, as a constant, and returns its name. The function
   * clones its markup when it can, and gives its HTML otherwise.
   */
  private bodyFunction(params: string, content: () => void): string {
    const name = this.unique('body');
    this.line(`const ${name} = (${params}) => {`);
    const fn = this.currentFn;
    this.line(`let $$html = '';`);
    content();
    this.flush();
    const cloned = cloneLines(this, this.options.hoist!, fn);
    this.line(this.returnLine(fn, cloned));
    this.close('};');
    return name;
  }

  /**
   * In the browser, an `#if`, a `#switch`, a `#for` or a `#repeat` that renders where it is
   * builds its nodes with a function for each body, so the markup around it and its bodies can
   * clone. `branchNodes` and `listNodes` write its markers, when it has them.
   */
  private emitNodesBlock(block: Block, scope: Scope): boolean {
    if (
      this.options.mode !== 'client' ||
      !this.options.hoist ||
      (block.kind === 'for' && block.window !== undefined)
    ) {
      return false;
    }
    const anchor = this.anchor(scope, block);
    const marks = anchor ? `${anchor.scope}, ${anchor.index}` : 'undefined, undefined';
    if (block.kind === 'if' || block.kind === 'switch') {
      const branches = block.kind === 'if' ? block.branches : block.cases;
      const bodies: string[] = [];
      for (const branch of branches) {
        bodies.push(this.bodyFunction('', () => this.emitBody(branch.body)));
      }
      const fallback = block.fallback;
      const other = fallback && this.bodyFunction('', () => this.emitBody(fallback));
      // The index of the branch that shows, then its function.
      let index = other ? String(branches.length) : '-1';
      for (let at = branches.length - 1; at >= 0; at--) {
        index = `${this.expression(branches[at]!.condition)} ? ${at} : ${index}`;
      }
      const names = `[${[...bodies, ...(other ? [other] : [])].join(', ')}]`;
      this.code(`$$b.nodes($$b.branchNodes(${marks}, ${index}, ${names}))`);
      return true;
    }
    if (block.kind === 'for' || block.kind === 'repeat') {
      const item = this.unique('item');
      const index = this.unique('index');
      const body = this.bodyFunction(`${item}, ${index}`, () => this.emitItem(block, item, index));
      const fallback = block.fallback;
      const other = fallback && this.bodyFunction('', () => this.emitBody(fallback));
      const items =
        block.kind === 'for'
          ? `$$b.toList(${this.expression(block.list)})`
          : `Array.from({ length: ${this.expression(block.count)} }, (_, index) => index)`;
      this.code(`$$b.nodes($$b.listNodes(${marks}, ${items}, ${body}, ${other ?? 'undefined'}))`);
      return true;
    }
    return false;
  }

  /** The tag of a spacer in the element around, for a row of a table or an item of a list. */
  private parentSpacer(): string | undefined {
    const parent = this.elements.at(-1);
    if (parent === undefined) {
      return undefined;
    }
    if (/^(tbody|thead|tfoot|table)$/.test(parent)) {
      return 'tr';
    }
    return /^(ul|ol|menu)$/.test(parent) ? 'li' : undefined;
  }

  /**
   * The tag of the spacers of a windowed list, as code: a row in a table, an item in a list, or
   * a `div`. In the children of a component, the element is the one where the component inserts
   * them, which the render gives as `$$ctx.tag`.
   */
  private spacerTag(): string {
    if (this.elements.length > 0) {
      return JSON.stringify(this.parentSpacer() ?? 'div');
    }
    return this.options.mode === 'server' ? `$$b.spacerTag($$ctx)` : `'div'`;
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
    if (this.emitFill(block, scope) || this.emitNodesBlock(block, scope)) {
      return;
    }
    switch (block.kind) {
      case 'if':
      case 'switch': {
        const branches = block.kind === 'if' ? block.branches : block.cases;
        const fallback = block.fallback;
        for (const [index, branch] of branches.entries()) {
          if (index === 0) {
            this.line(`if ${this.expression(branch.condition)} {`);
          } else {
            this.close(`} else if ${this.expression(branch.condition)} {`);
          }
          this.open(scope, block, String(index));
          this.emitBody(branch.body);
          this.end(block);
        }
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
        // A windowed list renders its first items, between spacers that give it the height of
        // the rest, and starts the window of the browser. See `windowStart` of the core.
        const windowed = block.kind === 'for' && block.window ? block.window : undefined;
        const shown = windowed && this.unique('shown');
        const spacer = windowed && this.spacerTag();
        if (windowed) {
          this.line(
            `const ${shown} = Math.min(${list}.length, ${windowed.count ? this.expression(windowed.count) : '20'});`,
          );
          this.html(`<`);
          this.code(spacer!);
          this.html(` data-window="before" aria-hidden="true" style="height: 0px"></`);
          this.code(spacer!);
          this.html('>');
        }
        this.open(scope, block);
        const from = this.itemSource(block);
        const source = from && this.unique('source');
        if (source) {
          // One array for the list, which every item shares.
          this.line(`const ${source} = ${from};`);
        }
        // An indexed loop, without an iterator and an `[index, item]` pair for each item.
        this.line(`for (let ${index} = 0; ${index} < ${shown ?? `${list}.length`}; ${index}++) {`);
        this.line(`const ${item} = ${list}[${index}];`);
        this.emitItem(block, item, index, source);
        this.close();
        if (block.fallback) {
          this.line(`if (${list}.length === 0) {`);
          this.emitBody(block.fallback);
          this.close();
        }
        this.end(block);
        if (windowed) {
          const anchor = this.anchor(scope, block)!;
          this.html(`<`);
          this.code(spacer!);
          this.html(` data-window="after" aria-hidden="true" style="height: `);
          this.code(`((${list}.length - ${shown}) * (${this.expression(windowed.height)}))`);
          this.html(`px"></`);
          this.code(spacer!);
          this.html('><template b-b="');
          this.code(anchor.scope);
          this.html(
            `:${anchor.index}" b-client="load=${this.plan.id}#w${anchor.index}"></template>`,
          );
        }
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
        // A `#loading` body inside that fails after the page is sent renders the `#catch` body then.
        const end = server ? this.emitCatcher(block, scope) : undefined;
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
          // On the server the page state carries this value, so production sends a safe error.
          this.line(
            `const ${block.error.name} = ${server ? `$$b.caught(${error}, $$ctx)` : error};`,
          );
        }
        if (block.reset) {
          this.line(`const ${block.reset.name} = undefined;`);
        }
        this.emitBody(block.fallback);
        if (end) {
          this.close('} finally {');
          this.line(`${end}();`);
        }
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
        for (const name of attribute.value.split(/\s+/)) {
          if (name) {
            classes.push(name);
          }
        }
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

/** The entities that escape the characters of a class in an attribute. */
const CLASS_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '"': '&quot;' };

/** Escapes a class for an attribute, as the runtime does. */
function escapeClass(name: string): string {
  return name.replace(/[&<"]/g, (char) => CLASS_ESCAPES[char]!);
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
  function visit(node: oxc.Node | null): boolean {
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
      for (const element of node.elements) {
        if (!visit(element)) {
          return false;
        }
      }
      return true;
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
      let name: string | undefined;
      if (key.type === 'Identifier') {
        name = key.name;
      } else if (key.type === 'Literal' && typeof key.value === 'string') {
        name = key.value;
      }
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
  }
  return visit(value) ? parts : undefined;
}

/**
 * The code of the text that the runtime makes of a literal class value,
 * for the client to set. An empty text removes the attribute.
 */
export function classText(classes: ClassPart[]): string {
  let plain = true;
  const names: string[] = [];
  for (const part of classes) {
    if (part.condition !== undefined) {
      plain = false;
    }
    names.push(part.name);
  }
  if (plain) {
    return JSON.stringify(names.join(' '));
  }
  const [first] = classes;
  if (classes.length === 1 && first) {
    return `((${first.condition}) ? ${JSON.stringify(first.name)} : "")`;
  }
  const pieces: string[] = [];
  for (const part of classes) {
    const text = JSON.stringify(` ${part.name}`);
    pieces.push(part.condition === undefined ? text : `((${part.condition}) ? ${text} : "")`);
  }
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
