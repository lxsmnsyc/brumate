import { crossSerialize, crossSerializeStream, fromJSON } from 'seroval';
import type { SerovalJSON } from 'seroval';
import {
  VOID_ELEMENTS,
  actionAttributes,
  escape,
  escapeAttribute,
  insertValue,
  isRaw,
  rawHTML,
  spread as spreadAttributes,
  styleElement,
} from './html.ts';
import { MODIFIERS } from './events.ts';
import type { Raw } from './html.ts';
import { disabledFeatures, plugins } from './serial.ts';
import {
  CHILDREN,
  ElementReference,
  FunctionReference,
  ITEM,
  ITEM_SLOT,
  MODULE,
  OWNER,
  PREFIX,
  SOURCE,
  isAsyncIterable,
  parseId,
} from './shared.ts';
import { Upload, functionReferences, replaceDeep } from './calls.ts';
import { STREAM_TYPE, toChunkStream } from './stream.ts';
import type { PackedState, PageState, ScopeId, ScopeState } from './shared.ts';
import { Redirect, RequestEvent, ServerError, isRedirect, unwrap, withEvent } from './request.ts';
import type { Context as ContextValue } from './context.ts';

export {
  affix,
  attribute,
  classAttribute,
  escape,
  escapeAttribute,
  mergeAttributes,
  raw,
  vars,
} from './html.ts';
export type { Raw } from './html.ts';
export { produce } from './produce.ts';
export { createContext } from './context.ts';
import { matchRoute, missingPage, notFound } from './router.ts';
import type { MiddlewareLoader, RouteMatch, RouteNode, RouteView } from './router.ts';
export { matchRoute } from './router.ts';
export type {
  EndpointLoader,
  Handler,
  Loader,
  Middleware,
  MiddlewareLoader,
  RouteMatch,
  RouteNode,
  RouteView,
} from './router.ts';
export {
  RequestEvent,
  ServerError,
  dedupe,
  getEvent,
  isRedirect,
  redirect,
  withEvent,
} from './request.ts';
export type { Redirect } from './request.ts';
export { ValidationError, fieldErrors, parse, parseForm, safeParse } from './validate.ts';
export type { ParseResult, ValidationIssue } from './validate.ts';
export type { StandardSchemaV1 } from './standard-schema.ts';
export { createSession, parseCookies, serializeCookie, toNodeHeaders } from './cookies.ts';
export type { CookieOptions, Session, SessionOptions } from './cookies.ts';
export { ElementReference, FunctionReference };
export type { PageState, ScopeId, ScopeState };

/** The scope and the slot that hold the list of a list item. */
export type ItemSource = readonly [scope: ScopeId, slot: number];

/** A `#loading` body that renders after the rest of the page. */
interface Boundary {
  id: ScopeId;
  /** Resolves to the body's markup, and its scopes in `ctx.state`. */
  render: Promise<{ html: string; ctx: Context }>;
  /** True when a `#try` body around it failed, so its markers were never sent. */
  cancelled?: boolean;
  /** A body around the target of a request for a `#defer` body, which renders but is not sent. */
  around?: boolean;
}

/** True if a boundary holds `target`, whose ID starts with the boundary's ID and a dot. */
function holdsBoundary(id: ScopeId, target: ScopeId): boolean {
  return typeof target === 'string' && target.startsWith(`${id}.`);
}

/** The `#defer` body that a render renders, for the request of the browser that asks for it. */
export interface DeferTarget {
  /** The boundary ID of the block. */
  boundary: ScopeId;
  /** The scope and the anchor of the block, as `<scope>:<anchor>`, which the render checks. */
  at: string;
  /**
   * `found` once the render reaches the block at `at`. `moved` when it reaches the boundary
   * elsewhere, such as after the data of the page changed and moved the IDs before it.
   */
  status?: 'found' | 'moved';
}

/** A point in a render that `restore` goes back to. */
export interface Mark {
  /** The prefix of the IDs of the block that the render was in, and its counters then. */
  prefix: string;
  scope: number;
  boundary: number;
  /** How many blocks the render was in. */
  depth: number;
  undo: number;
  owner: ScopeId | undefined;
}

/**
 * Where a render takes its scope and boundary IDs from. The page takes
 * numbers from its base. Each `#loading` body has its own, whose IDs are the
 * ID of its boundary, a dot and a number, such as `5.0`. A body resumes when
 * its data arrives, so with one counter for the page its IDs, and those of
 * the markup after it, would depend on that order.
 *
 * A block whose shape depends on data, such as an `#if` or a `#for`, also
 * numbers the scopes of its bodies after an ID of its own. The markup after
 * the block then keeps its IDs, whichever branch rendered and however many
 * items a list had, so a later request for a `#defer` body numbers the page
 * the same way even when the user or the data before the block differs.
 */
interface IdSpace {
  /** `''` for the page, or the ID of the boundary or block and a dot. */
  prefix: string;
  scope: number;
  /** The counter of boundary IDs, which blocks take their IDs from too. */
  boundary: number;
}

function spaceId(space: IdSpace, n: number): ScopeId {
  return space.prefix ? `${space.prefix}${n}` : n;
}

/**
 * True for an ID that a render made after `mark`: a scope of the same space
 * from its counter on, or a scope inside a block or boundary from then on.
 */
function madeAfter(mark: Mark, id: ScopeId): boolean {
  const text = String(id);
  if (!text.startsWith(mark.prefix)) {
    return false;
  }
  const rest = text.slice(mark.prefix.length);
  const dot = rest.indexOf('.');
  return dot === -1 ? Number(rest) >= mark.scope : Number(rest.slice(0, dot)) >= mark.boundary;
}

/**
 * Tracks the scopes of one render. A `#loading` body renders in a child
 * context, so its scopes are written with its markup.
 */
export class Context {
  readonly state: PageState = {};
  private readonly root: Context;
  /** The ID spaces of the blocks that the render is in, from the outside in. */
  private readonly spaces: IdSpace[];
  private readonly baseId: number;
  /** The `#defer` body to render, in the request for it. The rest of the page renders no body. */
  target: DeferTarget | undefined;
  /** True in the context of the target body and the bodies inside it. */
  private inTarget = false;
  private readonly boundaries: Boundary[] = [];
  private readonly styles = new Set<string>();
  /** Markup of `#portal` blocks, written at the end of the page. */
  readonly portals: string[] = [];
  /** Markup of `#head` blocks. */
  private readonly heads: string[] = [];
  private pageTitle: string | undefined;
  private onBoundary: ((boundary: Boundary) => void) | undefined;
  /** The scope tree of the whole page, for finding contexts across `#loading` bodies. */
  private readonly tree = new Map<ScopeId, { parent?: ScopeId; values?: Map<string, unknown> }>();
  /** The scope that renders the next component, which becomes its owner. */
  private owner: ScopeId | undefined;
  /**
   * Children that render where they are inserted: the scope of the markup
   * that wrote them, and the scope where they are, for their contexts.
   */
  private readonly inserted: { from: ScopeId; at: ScopeId }[] = [];
  /** Takes back what this context added to the page, from the newest, for `restore`. */
  private readonly undo: (() => void)[] = [];

  /** The URL prefix of server function calls. */
  private rpcPrefix = '/_brumate';
  /** The names of the slots of each scope, so an error can name a value that cannot be sent. */
  readonly slotNames: Map<ScopeId, string[]> = new Map();

  /** Results of server functions that a form posted to this page, for `$action`. */
  actions: Map<unknown, unknown> = new Map();
  /** The request of the page, when it renders with one. */
  event: RequestEvent | undefined;
  /** Results of server function calls in this render, so the same call runs once. */
  readonly calls: Map<string, unknown> = new Map();

  /** The event of the page, for `getEvent()` in a component, which the compiler rewrites to this. */
  getEvent(): RequestEvent {
    const event = this.root.event;
    if (!event) {
      throw new Error('getEvent() works while a page renders with a request, such as in a route');
    }
    return event;
  }

  /** Runs code of the render with its event and its call results, such as a memo's compute. */
  run<T>(callback: () => T): T {
    return withEvent(this.root.event, callback, this.root.calls);
  }

  /** The result of a server function that a form posted to this page. */
  actionResult(fn: unknown): unknown {
    return this.root.actions.get(unwrap(fn));
  }

  /** `prefix` is the boundary ID and a dot, for the context of a `#loading` body. */
  constructor(root?: Context, rpc?: string, base = 0, prefix = '') {
    this.root = root ?? this;
    if (rpc) {
      this.rpcPrefix = rpc;
    }
    this.spaces = [
      prefix ? { prefix, scope: 0, boundary: 0 } : { prefix, scope: base, boundary: base },
    ];
    this.baseId = base;
  }

  /** The base of the render, which the browser sends back to ask for a `#defer` body. */
  base(): number {
    return this.root.baseId;
  }

  /** True in a request for a `#defer` body, outside the body, once the body has started. */
  past(): boolean {
    return this.root.target?.status === 'found' && !this.inTarget;
  }

  /**
   * A number above every scope and boundary ID of the page so far, so a
   * later render can start there. The IDs inside boundaries start with one.
   */
  next(): number {
    const space = this.root.spaces[0]!;
    return Math.max(space.scope, space.boundary);
  }

  /** The space that the next IDs come from. */
  private get space(): IdSpace {
    return this.spaces.at(-1)!;
  }

  /**
   * Starts a block whose shape depends on data, such as an `#if` or a
   * `#for`. The scopes of its bodies are numbered after one ID that the
   * block takes, until `leave`.
   */
  enter(): void {
    const id = spaceId(this.space, this.space.boundary++);
    this.spaces.push({ prefix: `${id}.`, scope: 0, boundary: 0 });
  }

  /** Ends the block that `enter` started. */
  leave(): void {
    this.spaces.pop();
  }

  /** Returns the URL prefix of server function calls. */
  rpc(): string {
    return this.root.rpcPrefix;
  }

  /**
   * Returns a new scope ID. `kind` is the scope's ID in the compiled
   * component, `parent` is the scope that contains it, and `module` is the
   * component ID of a component's root scope.
   */
  scope(kind: number, parent?: ScopeId, module?: string): ScopeId {
    const root = this.root;
    const id = spaceId(this.space, this.space.scope++);
    const record = this.record(id);
    record.k = kind;
    if (parent !== undefined) {
      record.p = parent;
    }
    let up = parent;
    if (module !== undefined) {
      record.m = module;
      // A component's root scope links to the scope that rendered it.
      if (root.owner !== undefined) {
        record.o = root.owner;
        up = root.owner;
        root.owner = undefined;
      }
    }
    // A scope at the top of children that are inserted elsewhere finds its contexts there.
    const inserted = root.inserted.findLast((entry) => entry.from === up);
    if (inserted) {
      up = inserted.at;
      record.t = inserted.at;
    }
    root.tree.set(id, { parent: up });
    return id;
  }

  /**
   * Renders children where a component inserts them, at `at`. Their scopes
   * keep `from`, the scope of the markup that wrote them, for their values,
   * and find their contexts from `at`.
   */
  async children(from: ScopeId, at: ScopeId, renderBody: () => Promise<string>): Promise<string> {
    const entry = { from, at };
    const { inserted } = this.root;
    inserted.push(entry);
    try {
      return await renderBody();
    } finally {
      inserted.splice(inserted.indexOf(entry), 1);
    }
  }

  /**
   * The ID that `$id()` makes: the scope's ID and the position of the call.
   * A dot in a scope ID inside a `#loading` body becomes `_`, so the ID also
   * works as a CSS selector, such as `#b5_1-0`.
   */
  id(scope: ScopeId, index: number): string {
    return `b${String(scope).replace(/\./g, '_')}-${index}`;
  }

  /** Sets the owner of the next component's root scope. */
  own(scope: ScopeId): void {
    this.root.owner = scope;
  }

  /** Provides a value of a context to the scopes inside `scope`. */
  provide<T>(context: ContextValue<T>, value: T, scope: ScopeId): void {
    const node = this.root.tree.get(scope)!;
    node.values ??= new Map();
    node.values.set(context.key, value);
    const record = this.record(scope);
    record.v ??= {};
    record.v[context.key] = value;
  }

  /**
   * Reads a context from the nearest scope that provides it, starting at
   * `scope`. With `slot`, records which slot holds it, so the client can
   * update it when the provided value changes.
   */
  consume<T>(context: ContextValue<T>, scope: ScopeId, slot?: number): T {
    if (slot !== undefined) {
      const record = this.record(scope);
      record.x ??= {};
      record.x[context.key] = slot;
    }
    for (let id: ScopeId | undefined = scope; id !== undefined;) {
      const node = this.root.tree.get(id);
      if (node?.values?.has(context.key)) {
        return node.values.get(context.key) as T;
      }
      id = node?.parent;
    }
    return context.defaultValue;
  }

  /** The ID that the next call to `scope()` returns. */
  peek(): ScopeId {
    return spaceId(this.space, this.space.scope);
  }

  /** Marks the render so far, such as before a `#try` body, for `restore`. */
  mark(): Mark {
    const { prefix, scope, boundary } = this.space;
    return {
      prefix,
      scope,
      boundary,
      depth: this.spaces.length,
      undo: this.undo.length,
      owner: this.root.owner,
    };
  }

  /**
   * Takes back what the render added to the page since `mark`, such as a
   * `#try` body that threw, whose markup is not sent: its scopes, the
   * stylesheets it counted as sent, its `#portal` and `#head` markup, its
   * title, its `#loading` bodies, and its links to child components.
   */
  restore(mark: Mark): void {
    this.drop(mark);
    // A body that threw left the blocks inside it without `leave`.
    this.spaces.length = mark.depth;
    for (const undo of this.undo.splice(mark.undo).toReversed()) {
      undo();
    }
    this.root.owner = mark.owner;
  }

  /**
   * Forgets the scopes of this render from `from` on, such as those of a
   * `#try` body that threw, so the client does not resume markup that was
   * never sent. `#loading` bodies render in contexts of their own, so their
   * scopes stay.
   */
  private drop(mark: Mark): void {
    for (const key of Object.keys(this.state)) {
      const id = parseId(key);
      if (madeAfter(mark, id)) {
        delete this.state[id];
        this.root.slotNames.delete(id);
        this.root.tree.delete(id);
        this.sources.delete(id);
      }
    }
  }

  private record(scope: ScopeId): ScopeState {
    this.state[scope] ??= {};
    return this.state[scope];
  }

  slots(scope: ScopeId, values: unknown[], names?: string[]): void {
    this.record(scope).s = values;
    if (names) {
      this.root.slotNames.set(scope, names);
    }
  }

  /**
   * The list of each list item scope whose list is a slot of an enclosing
   * scope, as `[scope, slot]`. The items of a list share one array.
   */
  readonly sources: Map<ScopeId, ItemSource> = new Map();

  /**
   * Records the item of a list that can change on the client. `source` is
   * the scope and slot that hold the list, when the compiler found one, so
   * the client can take the item from there.
   */
  item(scope: ScopeId, value: unknown, source?: ItemSource): void {
    this.record(scope).i = value;
    if (source) {
      this.sources.set(scope, source);
    }
  }

  /** Records the scope of a child component at an anchor of its parent. */
  link(scope: ScopeId, anchor: number, child: ScopeId): void {
    const record = this.record(scope);
    const links = (record.c ??= {});
    links[anchor] = child;
    this.undo.push(() => {
      if (links[anchor] === child) {
        delete links[anchor];
      }
    });
  }

  /** Returns the reference that a `ref` signal holds on the server. */
  element(scope: ScopeId, anchor: number): ElementReference {
    return new ElementReference(scope, anchor);
  }

  /** Marks a function as a client function, so it serializes as a reference. */
  fn<T>(value: T, ref: string, scope: ScopeId): T {
    if (typeof value === 'function') {
      functionReferences.set(value, new FunctionReference(ref, scope));
    }
    return value;
  }

  /** Returns a component's stylesheet the first time the page renders the component. */
  style(id: string, css: string): string {
    const styles = this.root.styles;
    if (styles.has(id)) {
      return '';
    }
    styles.add(id);
    this.undo.push(() => styles.delete(id));
    return styleElement(id, css);
  }

  /** Adds the markup of a `#head` block. */
  head(html: string): void {
    // After the first render, the head has been sent, so a `#loading` body sends its own.
    const heads = (this.root.sent ? this : this.root).heads;
    heads.push(html);
    this.undo.push(() => removeLast(heads, html));
  }

  /** Sets the title of the page. The last call wins. */
  title(value: unknown): void {
    const target = this.root.sent ? this : this.root;
    const previous = target.pageTitle;
    const title = value === null || value === undefined ? '' : String(value);
    target.pageTitle = title;
    this.undo.push(() => {
      if (target.pageTitle === title) {
        target.pageTitle = previous;
      }
    });
  }

  /** True once the first render is done, and its head is about to be sent. */
  private sent = false;

  /** Marks the first render as done. Head markup after it streams with its `#loading` body. */
  send(): void {
    this.root.sent = true;
  }

  /**
   * The head markup and the title that a `#loading` body set, after the
   * head was sent. The title is undefined if the body set none.
   */
  lateHead(): { html: string; title: string | undefined } {
    return { html: this.heads.join(''), title: this.pageTitle };
  }

  /** The markup for the document's head: the title and the `#head` blocks. */
  headHTML(): string {
    const title =
      this.root.pageTitle === undefined ? '' : `<title>${escape(this.root.pageTitle)}</title>`;
    return title + this.root.heads.join('');
  }

  /** Adds the markup of a `#portal` block, which goes after the rest of the page. */
  portal(html: string): void {
    this.portals.push(html);
    this.undo.push(() => removeLast(this.portals, html));
  }

  /** Returns the ID of a new `#loading` boundary. */
  boundary(): ScopeId {
    return spaceId(this.space, this.space.boundary++);
  }

  /** Renders a `#loading` body after the rest of the page, in its own context and ID space. */
  defer(id: ScopeId, renderBody: (ctx: Context) => Promise<string>): void {
    const target = this.root.target;
    if (!target || this.inTarget) {
      this.register(id, renderBody, this.inTarget);
    } else if (holdsBoundary(id, target.boundary)) {
      // The request for a `#defer` body renders the bodies around it, without sending them.
      this.register(id, renderBody, false, true);
    }
  }

  /**
   * Renders the body of a `#defer` block, in the request for it. `at` is
   * the scope and the anchor of the block. A page renders only the
   * fallback, so it does nothing then.
   */
  deferBlock(id: ScopeId, at: string, renderBody: (ctx: Context) => Promise<string>): void {
    const target = this.root.target;
    if (!target || this.inTarget) {
      return;
    }
    if (holdsBoundary(id, target.boundary)) {
      this.register(id, renderBody, false, true);
      return;
    }
    if (id !== target.boundary) {
      return;
    }
    if (at !== target.at) {
      target.status = 'moved';
      return;
    }
    target.status = 'found';
    this.register(id, renderBody, true);
  }

  private register(
    id: ScopeId,
    renderBody: (ctx: Context) => Promise<string>,
    inTarget: boolean,
    around = false,
  ): void {
    const child = new Context(this.root, undefined, 0, `${id}.`);
    child.inTarget = inTarget;
    const boundary: Boundary = {
      id,
      render: renderBody(child).then((html) => ({ html, ctx: child })),
      around,
    };
    // The page does not wait for it, so a failure must not be unhandled.
    boundary.render.catch(() => {});
    const root = this.root;
    if (root.onBoundary) {
      root.onBoundary(boundary);
    } else {
      root.boundaries.push(boundary);
    }
    this.undo.push(() => {
      boundary.cancelled = true;
      removeLast(root.boundaries, boundary);
    });
  }

  /** Receives every boundary, including those registered before this call. */
  watch(onBoundary: (boundary: Boundary) => void): void {
    this.onBoundary = onBoundary;
    for (const boundary of this.boundaries.splice(0)) {
      onBoundary(boundary);
    }
  }
}

/** Removes the last copy of a value from a list. */
function removeLast<T>(list: T[], value: T): void {
  const index = list.lastIndexOf(value);
  if (index !== -1) {
    list.splice(index, 1);
  }
}

/** Thrown when code reads a memo whose value is still loading. It carries the load. */
export class NotReady extends Error {
  readonly source: Promise<unknown>;

  constructor(source: Promise<unknown>) {
    super('The value is still loading');
    this.name = 'NotReady';
    this.source = source;
  }
}

/** A memo on the server. It computes on its first read, so nothing waits for a memo that nothing reads. */
export interface Memo<T = unknown> {
  compute: () => T;
  /** The render, whose event server functions that the compute calls read. */
  ctx?: Context;
  state: 'idle' | 'pending' | 'done' | 'failed';
  value?: unknown;
  error?: unknown;
  load?: Promise<unknown>;
}

/** Declares a memo. Its value is computed when it is first read. */
export function memo<T>(compute: () => T, ctx?: Context): Memo<T> {
  return { compute, ctx, state: 'idle' };
}

/**
 * Reads a memo. A value that is still loading throws `NotReady` with its
 * load, and a memo that read such a value stays unread, so it computes
 * again when it is read after the load settles.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- Memos hold any value.
export function read(node: Memo): any {
  if (node.state === 'done') {
    return node.value;
  }
  if (node.state === 'failed') {
    throw node.error;
  }
  if (node.state === 'pending') {
    throw new NotReady(node.load!);
  }
  let value: unknown;
  try {
    // Server functions that it calls read the event of the page before their first await.
    value = node.ctx ? node.ctx.run(node.compute) : node.compute();
  } catch (error) {
    if (!(error instanceof NotReady)) {
      node.state = 'failed';
      node.error = error;
    }
    throw error;
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    (typeof (value as PromiseLike<unknown>).then === 'function' || isAsyncIterable(value))
  ) {
    node.state = 'pending';
    node.load = Promise.resolve(value)
      .then(firstValue)
      .then(
        (result) => {
          node.state = 'done';
          node.value = result;
        },
        (error: unknown) => {
          node.state = 'failed';
          node.error = error;
        },
      );
    throw new NotReady(node.load);
  }
  node.state = 'done';
  node.value = value;
  return value;
}

/**
 * The first value of an async iterable, such as a server function that
 * streams. A page renders once, so the server stops reading after it. Other
 * values are themselves.
 */
async function firstValue(value: unknown): Promise<unknown> {
  if (!isAsyncIterable(value)) {
    return value;
  }
  const iterator = value[Symbol.asyncIterator]();
  const first = await iterator.next();
  await iterator.return?.();
  return first.value;
}

/** Waits for the value of a memo, through every load it reads. */
export async function wait(node: Memo): Promise<unknown> {
  for (;;) {
    try {
      return read(node);
    } catch (error) {
      if (!(error instanceof NotReady)) {
        throw error;
      }
      // oxlint-disable-next-line no-await-in-loop -- Each load can reveal another one.
      await error.source.catch(() => {});
    }
  }
}

/**
 * The value of a memo when it is ready, or a promise of it while it loads.
 * The render then awaits only a memo that is loading.
 */
export function ready(node: Memo): unknown {
  try {
    return read(node);
  } catch (error) {
    if (error instanceof NotReady) {
      return wait(node);
    }
    throw error;
  }
}

const LAZY: unique symbol = Symbol.for('brumate.lazy');

/** Markup that renders where it is inserted, so it can read the contexts there. */
export interface Lazy {
  [LAZY]: (ctx: Context, scope: ScopeId | undefined) => Promise<string>;
}

/**
 * The children of a component, which render where the component inserts
 * them, so they read the contexts that the component provides. `from` is the
 * scope of the markup that wrote them.
 */
export function children(from: ScopeId, renderBody: (ctx: Context) => Promise<string>): Lazy {
  return new Children(from, renderBody);
}

/** The symbol of raw HTML. See `html.ts`. */
const RAW: unique symbol = Symbol.for('brumate.raw') as never;

/**
 * Children of a component. The first render keeps its HTML as raw HTML, so
 * the page state sends it for the browser to insert, such as when a block
 * that holds the children opens. A class, since the serializer tests only
 * class instances.
 */
class Children implements Lazy {
  readonly [LAZY]: (ctx: Context, at: ScopeId | undefined) => Promise<string>;
  /** The HTML of the first render, under the symbol of raw HTML. */
  [RAW]?: string;

  constructor(from: ScopeId, renderBody: (ctx: Context) => Promise<string>) {
    this[LAZY] = async (ctx, at) => {
      const html = await (at === undefined
        ? renderBody(ctx)
        : ctx.children(from, at, () => renderBody(ctx)));
      this[RAW] ??= html;
      return html;
    };
  }
}

/** Makes markup that renders where it is inserted, such as the children of a layout. */
export function lazy(
  renderAt: (ctx: Context, scope: ScopeId | undefined) => Promise<string>,
): Lazy {
  return { [LAZY]: renderAt };
}

function isLazy(value: unknown): value is Lazy {
  return typeof value === 'object' && value !== null && LAZY in value;
}

/** Renders the attributes of a form or button that posts to a server function. */
export function action(
  ctx: Context,
  name: string,
  id: string,
  method?: string,
  result?: string,
): string {
  return actionAttributes(ctx.rpc(), name, id, method, result);
}

/**
 * The result of a server function that a form posted to this page, for
 * `$action`, or undefined when the page was not rendered for a post.
 */
export function actionResult(ctx: Context, fn: unknown): unknown {
  return ctx.actionResult(fn);
}

/**
 * Renders a value inserted in markup. `ctx` and `scope` are where it is
 * inserted, for markup that renders there.
 */
export function insert(value: unknown, ctx?: Context, scope?: ScopeId): string | Promise<string> {
  // A value that is ready renders without a promise, because most inserts are plain text.
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  ) {
    return Promise.resolve(value).then((resolved) => insert(resolved, ctx, scope));
  }
  if (isLazy(value) && ctx) {
    return value[LAZY](ctx, scope);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => insert(item, ctx, scope));
    return parts.every((part) => typeof part === 'string')
      ? parts.join('')
      : Promise.all(parts).then((all) => all.join(''));
  }
  return insertValue(value);
}

// oxlint-disable-next-line typescript/no-explicit-any -- Components take any props.
export type Component<P = any> = (props: P, ctx: Context) => Promise<string>;

/**
 * Renders a child component. With `scope` and `anchor`, records the child's
 * scope so the parent can update its props on the client.
 */
export function component<P>(
  Child: Component<P>,
  props: P,
  ctx: Context,
  scope?: ScopeId,
  anchor?: number,
): Promise<string> {
  // A request for a `#defer` body sends only that body, so the rest of the page renders no more
  // components once the body has started, and loads no more of their data.
  if (ctx.past()) {
    return Promise.resolve('');
  }
  if (scope !== undefined && anchor !== undefined) {
    ctx.link(scope, anchor, ctx.peek());
  }
  if (scope !== undefined) {
    ctx.own(scope);
  }
  const given = (props as { children?: unknown } | undefined)?.children;
  if (!(given instanceof Children)) {
    return Child(props, ctx);
  }
  // Children that the component did not insert render after it, inside its root scope, so the
  // page state has their HTML for the browser.
  const root = ctx.peek();
  return Child(props, ctx).then(async (html) => {
    if (given[RAW] === undefined) {
      await given[LAZY](ctx, root);
    }
    return html;
  });
}

/** Renders a dynamic tag, which can be an element name or a component. */
export function dynamic(
  tag: string | Component,
  attributes: Record<string, unknown>,
  content: Raw | Lazy | undefined,
  ctx: Context,
  scope?: ScopeId,
): string | Promise<string> {
  if (typeof tag === 'function') {
    // The handlers of the tag belong to this component, so they name its scope for the
    // component that renders the element.
    const entries = attributes['b-on'];
    const props =
      typeof entries === 'string' && scope !== undefined
        ? {
            ...attributes,
            'b-on': entries
              .split(' ')
              .map((entry) => (entry.includes('@') ? entry : `${entry}@${scope}`))
              .join(' '),
          }
        : attributes;
    return component(tag, content ? { ...props, children: content } : props, ctx, scope);
  }
  // The handlers of a dynamic element, and those that its props pass on, go into one `b-on`.
  const on: string[] = [];
  const open = `<${tag}${spread(attributes, on)}${onAttribute(on, '')}>`;
  if (VOID_ELEMENTS.has(tag)) {
    return open;
  }
  if (isLazy(content)) {
    return Promise.resolve(content[LAZY](ctx, scope)).then((html) => `${open}${html}</${tag}>`);
  }
  return `${open}${content && isRaw(content) ? rawHTML(content) : ''}</${tag}>`;
}

/** True when `value` is `target`, or holds it in plain objects, arrays, maps or sets. */
function holds(value: unknown, target: unknown, seen = new Set<unknown>()): boolean {
  if (value === target) {
    return true;
  }
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return false;
  }
  seen.add(value);
  const items =
    value instanceof Map
      ? [...value.keys(), ...value.values()]
      : value instanceof Set
        ? [...value]
        : Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype
          ? Object.values(value)
          : [];
  return items.some((item) => holds(item, target, seen));
}

/**
 * The error of a value in the state of a page that cannot be sent to the
 * browser, which names the value and its component.
 */
function unsendable(error: unknown, ctx: Context): Error {
  const target = (error as { value?: unknown }).value;
  if (target === undefined) {
    return error instanceof Error ? error : new Error(String(error));
  }
  for (const [id, record] of Object.entries(ctx.state)) {
    const index = (record.s ?? []).findIndex((value) => holds(value, target));
    if (index === -1) {
      continue;
    }
    let owner: ScopeState | undefined = record;
    while (owner && owner.m === undefined && owner.p !== undefined) {
      owner = ctx.state[owner.p];
    }
    const name = ctx.slotNames.get(parseId(id))?.[index] ?? `slot ${index}`;
    const kind = (target as object)?.constructor?.name ?? typeof target;
    return new Error(
      `The value of "${name}" in ${owner?.m ?? 'a component'} holds a ${kind}, which cannot be sent to the browser, and code that runs in the browser reads it. Use it in a server function, or create it in the browser, such as in $client.`,
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** JSON that is safe in a `<script>`, with each `<` escaped. */
function scriptJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** The fields that a record in a group of `PackedState` can have. */
const PACKED_FIELDS = new Set(['k', 'p', 'o', 'm', 's', 'i', 'c']);

/** A group of `PackedState` while `packState` collects it. */
interface PackGroup {
  k: number;
  base: ScopeId;
  flags: number;
  count: number;
  m: string | undefined;
  /** The prefix of the IDs inside a `#loading` body, or `''`. */
  prefix: string;
  ids: ScopeId[];
  /** The number of each ID after its prefix. */
  numbers: number[];
}

/** The prefix of an ID and its number after it, such as `['', 3]` or `['5.', 1]`. */
function splitId(id: ScopeId): [prefix: string, n: number] {
  if (typeof id === 'number') {
    return ['', id];
  }
  const dot = id.lastIndexOf('.');
  return [id.slice(0, dot + 1), Number(id.slice(dot + 1))];
}

/**
 * The list that the client can take the items of a group from: the items
 * are list items with the same source, the source's record is in `state`,
 * and the item of the scope at each position of the group is the value at
 * that position of the list. The client reads the same list, so it gets the
 * same values. Otherwise the items are written.
 */
function groupSource(
  state: PageState,
  sources: Map<ScopeId, ItemSource>,
  group: PackGroup,
): ItemSource | undefined {
  const source = sources.get(group.ids[0]!);
  if (!source || !(group.flags & (ITEM | ITEM_SLOT))) {
    return undefined;
  }
  const value = state[source[0]]?.s?.[source[1]];
  // Seroval keeps the order of a Set. A Map's entries are new arrays, which the check below rejects.
  const list = Array.isArray(value) ? value : value instanceof Set ? Array.from(value) : undefined;
  if (!list || list.length < group.ids.length) {
    return undefined;
  }
  for (let n = 0; n < group.ids.length; n++) {
    const id = group.ids[n]!;
    if (sources.get(id) !== source || !Object.is(list[n], state[id]!.i)) {
      return undefined;
    }
  }
  return source;
}

/**
 * Writes the records of scopes with the same kind, parent and shape, such as
 * the items of a list, in groups. Each one then costs its slots and the gap
 * to the ID before it. The items of a list whose list is in `sources` and in
 * the state are not written. See `PackedState`.
 */
export function packState(state: PageState, sources?: Map<ScopeId, ItemSource>): PackedState {
  const result: PackedState = {};
  const groups = new Map<string, PackGroup>();
  // Integer keys come in ascending order, and the keys inside a `#loading` body in the order
  // the body made them, so the gaps are positive.
  for (const [key, record] of Object.entries(state)) {
    const id = parseId(key);
    const [prefix, n] = splitId(id);
    // The root scope of a component in a list item has its own owner, the item, at the same
    // distance before it in each item. The parent of other scopes is the same for the group.
    let base: ScopeId | undefined = record.p;
    if (base === undefined && record.o !== undefined) {
      const [ownerPrefix, owner] = splitId(record.o);
      base = ownerPrefix === prefix ? n - owner : undefined;
    }
    if (
      record.k === undefined ||
      base === undefined ||
      (record.p !== undefined && record.o !== undefined) ||
      !Object.keys(record).every((field) => PACKED_FIELDS.has(field))
    ) {
      result[id] = record;
      continue;
    }
    const slots = record.s ?? [];
    let flags = record.p === undefined ? OWNER : 0;
    if ('i' in record) {
      flags |= slots.length > 0 && Object.is(record.i, slots[0]) ? ITEM_SLOT : ITEM;
    }
    if (record.c) {
      flags |= CHILDREN;
    }
    if (record.m !== undefined) {
      flags |= MODULE;
    }
    const name = `${prefix}:${record.k}:${base}:${flags}:${slots.length}:${record.m ?? ''}`;
    const group = groups.get(name);
    if (group) {
      group.ids.push(id);
      group.numbers.push(n);
    } else {
      groups.set(name, {
        k: record.k,
        base,
        flags,
        count: slots.length,
        m: record.m,
        prefix,
        ids: [id],
        numbers: [n],
      });
    }
  }
  const packed: unknown[][] = [];
  for (const group of groups.values()) {
    const { ids } = group;
    // A group of one scope is no shorter than its record.
    if (ids.length === 1) {
      result[ids[0]!] = state[ids[0]!]!;
      continue;
    }
    const source = sources && sources.size > 0 ? groupSource(state, sources, group) : undefined;
    let flags = source ? group.flags | SOURCE : group.flags;
    if (group.prefix) {
      flags |= PREFIX;
    }
    const values: unknown[] = [group.k, group.base, flags, group.count];
    if (group.m !== undefined) {
      values.push(group.m);
    }
    if (source) {
      values.push(source[0], source[1]);
    }
    if (group.prefix) {
      values.push(group.prefix);
    }
    // With a source, the client takes the item, and the first slot when it is the item.
    const from = source && flags & ITEM_SLOT ? 1 : 0;
    const item = !source && flags & ITEM;
    // Inside a `#loading` body, and for component root scopes, the first gap is from 0.
    let last = flags & (OWNER | PREFIX) ? 0 : (group.base as number);
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]!;
      const number = group.numbers[index]!;
      const record = state[id]!;
      values.push(number - last);
      const slots = record.s ?? [];
      for (let n = from; n < slots.length; n++) {
        values.push(slots[n]);
      }
      if (item) {
        values.push(record.i);
      }
      if (flags & CHILDREN) {
        values.push(record.c);
      }
      last = number;
    }
    packed.push(values);
  }
  if (packed.length > 0) {
    result.g = packed;
  }
  return result;
}

/**
 * Serializes the page state as seroval cross-reference code, one record at
 * a time. The first record holds the state, and each later record settles a
 * promise in it. Records that share `refs` can refer to each other's values.
 *
 * With `last`, no later record of the render reads this one, so a state
 * without promises is one record that assigns only the references that it
 * uses twice. That record is smaller, and faster to write. A state with a
 * promise makes `crossSerialize` throw, and then it streams as usual.
 */
function serializeState(
  state: PageState,
  refs: Map<unknown, number>,
  onRecord: (code: string, initial: boolean) => void,
  onError: (error: unknown) => void,
  onDone: () => void,
  sources?: Map<ScopeId, ItemSource>,
  last = false,
): void {
  const packed = packState(state, sources);
  if (last) {
    let code: string | undefined;
    try {
      code = crossSerialize(packed, {
        plugins,
        disabledFeatures,
        refs,
        assignSharedRefsOnly: true,
      });
    } catch {
      // The stream gives the same error for a value that cannot be sent, with the same references.
      refs.clear();
    }
    if (code !== undefined) {
      onRecord(code, true);
      onDone();
      return;
    }
  }
  crossSerializeStream(packed, {
    plugins,
    disabledFeatures,
    refs,
    onSerialize: onRecord,
    onError,
    onDone,
  });
}

/**
 * Serializes the page state as the code of state records. `onRecord`
 * receives each record as soon as it is ready. The promise resolves when
 * every promise in the state has settled.
 */
export function streamState(
  state: PageState,
  onRecord: (code: string, initial: boolean) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    serializeState(state, new Map(), onRecord, reject, resolve);
  });
}

/**
 * Defines `$bR`, which hands the code of a state record and its script to
 * the core, through `self.$brm`. The core runs the code when it starts, or
 * at once when it has started. The first record of each render defines it.
 */
const RECORD = 'function $bR(f){(self.$brm=self.$brm||[]).push([document.currentScript,f])}';

export interface StateAttributes {
  /** A number above every ID so far, on each record with scopes. */
  next?: number;
  /** The first record of a render defines `$bR`. Later ones call it. */
  define?: boolean;
  /** The route of the page. */
  route?: string;
  /** The base of the render, when it is above 0, or the key of a `#defer` body's records. */
  root?: number | string;
  /** The Content Security Policy nonce of the script. */
  nonce?: string;
}

/**
 * Returns the script of a state record. `scopes` marks a record with scopes,
 * as opposed to one that settles a promise. The record is code that seroval
 * wrote, as a function of the references of its render, `$R`, and of the
 * functions that make brumate's values, `$b`. seroval escapes every `<` in
 * the strings in it.
 */
export function stateScript(
  code: string,
  scopes = false,
  attributes: StateAttributes = {},
): string {
  // seroval writes `<` in strings as `\\x3C`, so these never appear. A change there must not open the script.
  if (code.includes('</') || code.includes('<!')) {
    throw new Error('A state record would end its script');
  }
  let extra = attributes.nonce === undefined ? '' : ` nonce="${escapeAttribute(attributes.nonce)}"`;
  extra += ' b-state';
  if (scopes) {
    extra += ' b-scopes';
  }
  if (attributes.next !== undefined) {
    extra += ` b-next="${attributes.next}"`;
  }
  // Records of a render that starts above 0 name it, so their references stay apart from other renders.
  if (attributes.root) {
    extra += ` b-root="${attributes.root}"`;
  }
  if (attributes.route !== undefined) {
    extra += ` b-route="${escapeAttribute(attributes.route)}"`;
  }
  return `<script${extra}>${attributes.define ? RECORD : ''}$bR(($R,$b)=>(${code}))</script>`;
}

// Moves the head markup of a `#loading` body into the head, and sets the title.
const HEAD = `function $bH(i,t){var e=document.querySelector('template[b-h="'+i+'"]');e&&(document.head.append(e.content),e.remove());t!=null&&(document.title=t)}`;

// Moves a `#loading` body from its <template> into the page, in place of the fallback.
const SWAP = `function $bS(i){var t=document.querySelector('template[b-l="'+i+'"]'),w=document.createTreeWalker(document.body,128),s,n,d=0;while(n=w.nextNode())if(n.data==='l'+i){s=n;break}if(!s||!t)return;var p=s.parentNode;for(n=s.nextSibling;n;){if(n.nodeType===8){if(n.data==='/l'){if(!d)break;d--}else if(/^l\\d/.test(n.data))d++}var x=n.nextSibling;p.removeChild(n);n=x}p.insertBefore(t.content,s);p.removeChild(s);n&&p.removeChild(n);t.remove()}`;

export interface RenderResult {
  /** The markup. A `#loading` body that is not ready shows its fallback. */
  html: string;
  /** The script that holds the page state. */
  state: string;
  /**
   * Markup to write after the page, as it is ready: the bodies of
   * `#loading` blocks, and the state records that settle promises.
   */
  pending: AsyncIterable<string>;
  /** Headers that the page set while it rendered, such as cookies. */
  headers: Headers;
  /** The status that `setStatus` set while the page rendered, or 200. */
  status: number;
  /**
   * A number above every ID of this render, once its `#loading` bodies have
   * rendered. Another root on the same page passes it as `base`.
   */
  next: () => number;
  /** Markup for the document's head: the `$title` and the `#head` blocks. */
  head: string;
  /**
   * With the `defer` option, whether the render found the block: `found`,
   * `moved` when the boundary is at another place, such as after the data
   * of the page changed, or `missing`.
   */
  defer?: 'found' | 'moved' | 'missing';
}

/** The `pending` of a render that has nothing left to send. */
const NOTHING_PENDING: AsyncIterable<string> = {
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.resolve({ done: true, value: undefined }),
  }),
};

interface Queue<T> {
  push: (item: T) => void;
  close: () => void;
  fail: (error: unknown) => void;
  iterable: AsyncIterable<T>;
}

/** An async iterable that a producer pushes into. */
function createQueue<T>(): Queue<T> {
  const items: T[] = [];
  let wake: (() => void) | undefined;
  let closed = false;
  let failure: { error: unknown } | undefined;
  const notify = (): void => {
    wake?.();
    wake = undefined;
  };
  return {
    push(item) {
      items.push(item);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    fail(error) {
      failure = { error };
      notify();
    },
    iterable: {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          if (items.length > 0) {
            yield items.shift()!;
          } else if (failure) {
            throw failure.error;
          } else if (closed) {
            return;
          } else {
            // oxlint-disable-next-line no-await-in-loop -- Each wait is for the next item.
            await new Promise<void>((resolve) => {
              wake = resolve;
            });
          }
        }
      },
    },
  };
}

export interface RenderOptions {
  /** The URL prefix of server function calls, for forms that post to one. Defaults to `/_brumate`. */
  rpc?: string;
  /**
   * The first scope and boundary ID. A page that the client loads in place
   * of another starts above the IDs of the page it keeps parts of.
   */
  base?: number;
  /** Names the route of the page, so the client knows which layouts it can keep. */
  route?: string;
  /** Results of server functions that a form posted to this page, by function, for `$action`. */
  actions?: Map<unknown, unknown>;
  /**
   * The request of the page. Components and the server functions that their
   * memos call read it with `getEvent()`. Headers and cookies that they set
   * are in the `headers` that `render` returns.
   */
  request?: Request;
  /** The event of the request, in place of `request`, such as one that middleware already set cookies on. */
  event?: RequestEvent;
  /**
   * A Content Security Policy nonce for the inline scripts: the state
   * records, and the scripts that swap in `#loading` bodies.
   */
  nonce?: string;
  /**
   * Renders only the body of this `#defer` block, for the request that the
   * browser sends when the block's trigger fires. Pass the `base` of the
   * page too, so the IDs of the page come out the same. The body comes from
   * `pending`, and `html` and `state` are empty.
   */
  defer?: { boundary: ScopeId; at: string };
}

/**
 * Renders the parts of a page. It returns as soon as the markup is rendered.
 * `#loading` bodies and promises in the state do not hold it up: they come
 * later, from `pending`. `renderToStream` puts the parts together. Use this
 * directly to send the response headers that server functions set before
 * the stream starts.
 */
export async function render<P>(
  Root: Component<P>,
  props: P,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const scriptTag =
    options.nonce === undefined ? '<script>' : `<script nonce="${escapeAttribute(options.nonce)}">`;
  const ctx = new Context(undefined, options.rpc, options.base);
  if (options.actions) {
    ctx.actions = options.actions;
  }
  if (options.defer) {
    ctx.target = { ...options.defer };
  }
  const event = options.event ?? (options.request ? new RequestEvent(options.request) : undefined);
  ctx.event = event;
  // The first part of each component runs with the event, and so do memos, which the compiler gives `$$ctx`.
  const rendered = await ctx.run(() => Root(props, ctx));
  ctx.send();
  const html = beforeBodyEnd(rendered, ctx.portals.join(''));
  // The queue of `pending` is made only when something is pending, because it costs a lot for a small page.
  let queue: Queue<string> | undefined;
  const pending = (): Queue<string> => (queue ??= createQueue<string>());
  // Records share references, so later records can point into earlier ones.
  const refs = new Map<unknown, number>();
  const { nonce } = options;
  // The records of a `#defer` body have references of their own, apart from those of the page.
  const root = options.defer ? `d${options.defer.boundary}` : options.base;
  // The first record, the page state, defines `$bR` for the others.
  let first = true;
  let open = 0;
  let swap = false;
  let headSwap = false;
  const finish = (): void => {
    open--;
    if (open === 0) {
      queue?.close();
    }
  };
  // The page state is the only record when no `#loading` body is pending.
  let boundaries = 0;
  const serialize = (
    { state, sources }: Context,
    onScopes: (script: string) => void,
    route?: string,
    onError: (error: unknown) => void = (error) => pending().fail(error),
    last = false,
  ): void => {
    open++;
    serializeState(
      state,
      refs,
      (code, initial) => {
        if (initial) {
          onScopes(
            stateScript(code, true, { next: ctx.next(), route, root, nonce, define: first }),
          );
          first = false;
        } else {
          pending().push(stateScript(code, false, { root, nonce }));
        }
      },
      onError,
      finish,
      sources,
      last,
    );
  };

  ctx.watch((boundary) => {
    boundaries++;
    open++;
    boundary.render.then(
      (result) => {
        // A `#try` body around it failed, so the page has no markers for it. A body around the
        // target of a `#defer` request is in the page already.
        if (boundary.cancelled || boundary.around) {
          finish();
          return;
        }
        serialize(result.ctx, (script) => {
          // An ID inside a boundary, such as `5.1`, is a string.
          const id = scriptJSON(boundary.id);
          let call = `${swap ? '' : SWAP}$bS(${id})`;
          swap = true;
          const late = result.ctx.lateHead();
          let head = '';
          if (late.html || late.title !== undefined) {
            head = `<template b-h="${boundary.id}">${late.html}</template>`;
            const title = late.title === undefined ? '' : `,${scriptJSON(late.title)}`;
            call += `;${headSwap ? '' : HEAD}$bH(${id}${title})`;
            headSwap = true;
          }
          pending().push(
            // The body moves in before its record runs, so the core finds its markup when it reads the scopes.
            `<template b-l="${boundary.id}">${result.html}</template>${head}${result.ctx.portals.join('')}${scriptTag}${call}</script>${script}`,
          );
        });
        finish();
      },
      (error: unknown) => {
        // The fallback stays in the page.
        console.error(error);
        finish();
      },
    );
  });

  if (options.defer) {
    // The browser has the page. It gets only the body, from `pending`.
    return {
      html: '',
      state: '',
      pending: queue === undefined && open === 0 ? NOTHING_PENDING : pending().iterable,
      headers: event?.headers ?? new Headers(),
      status: event?.status ?? 200,
      next: () => ctx.next(),
      head: '',
      defer: ctx.target!.status ?? 'missing',
    };
  }

  let state = '';
  // The state of the page is serialized before this returns, so a value that cannot be sent
  // fails the render here, with its name, instead of leaving the page without its state.
  let failure: unknown;
  serialize(
    ctx,
    (script) => {
      state = script;
    },
    options.route,
    (error) => {
      failure = error;
    },
    boundaries === 0,
  );
  if (failure !== undefined) {
    throw unsendable(failure, ctx);
  }
  return {
    html,
    state,
    // Nothing is open when the page has no `#loading` body that is not ready and no promise in its state.
    pending: queue === undefined && open === 0 ? NOTHING_PENDING : pending().iterable,
    headers: event?.headers ?? new Headers(),
    status: event?.status ?? 200,
    next: () => ctx.next(),
    head: ctx.headHTML(),
  };
}

export interface DocumentOptions extends RenderOptions {
  /**
   * Markup before the component, for a component that does not render
   * `<html>`. A function receives the markup for the document's head.
   */
  start?: string | ((head: string) => string);
  /** Markup for the head, before the head of the components, such as the `<link>` of a CSS file. */
  head?: string;
  /**
   * Markup right after the page state, such as the client entry. Make
   * module scripts `async`, so they run before the stream ends.
   */
  scripts?: string;
  /** Markup after the first render, for a component that does not render `<html>`. */
  end?: string;
}

export type StreamOptions = DocumentOptions;

const HTML = /<html[\s>]/i;

/**
 * Inserts markup before `</body>`, or at the end if there is none. `index`
 * is where `</body>` is, when the caller found it already.
 */
function beforeBodyEnd(
  html: string,
  content: string,
  index = content ? html.toLowerCase().lastIndexOf('</body>') : -1,
): string {
  if (!content) {
    return html;
  }
  return index === -1 ? html + content : html.slice(0, index) + content + html.slice(index);
}

/**
 * Builds the first chunk of a page: the whole rendered document, with the
 * page state and the scripts. A component that renders `<html>` gets the
 * doctype, its head before `</head>`, and the state and scripts before
 * `</body>`. Markup that resolves later is written after it.
 */
function firstRender(
  html: string,
  componentHead: string,
  state: string,
  options: DocumentOptions,
): string {
  const head = (options.head ?? '') + componentHead;
  const tail = state + (options.scripts ?? '');
  const match = HTML.exec(html);
  if (!match) {
    const start = typeof options.start === 'function' ? options.start(head) : (options.start ?? '');
    return start + html + tail + (options.end ?? '');
  }
  // Markup before <html>, such as the stylesheet of the root component, belongs in the head.
  const headContent = html.slice(0, match.index) + head;
  let page = html.slice(match.index);
  // The page is lowercased once, to find its tags whatever their case.
  const lower = page.toLowerCase();
  const headEnd = lower.indexOf('</head>');
  let bodyEnd = lower.lastIndexOf('</body>');
  let at = headEnd;
  let inserted = headContent;
  if (headEnd === -1 && headContent) {
    const bodyStart = lower.search(/<body[\s>]/);
    at = bodyStart === -1 ? page.indexOf('>') + 1 : bodyStart;
    inserted = `<head>${headContent}</head>`;
  }
  if (at !== -1 && inserted) {
    page = page.slice(0, at) + inserted + page.slice(at);
    // `</body>` moves with the markup before it, or is in the head markup when that comes after it.
    const own = inserted.toLowerCase();
    if (bodyEnd >= at) {
      bodyEnd += own.length;
    } else if (own.includes('</body>')) {
      bodyEnd = at + own.lastIndexOf('</body>');
    }
  }
  return `<!doctype html>${beforeBodyEnd(page, tail, bodyEnd)}`;
}

/**
 * Renders a component as a stream. The first chunk is the whole first
 * render, sent as soon as it is ready. Each `#loading` body and each state
 * record that settles a promise follows it as it resolves. A component that
 * renders `<html>` gets the doctype and its head.
 */
export function renderToStream<P>(
  Root: Component<P>,
  props: P,
  options: DocumentOptions = {},
): ReadableStream<string> {
  return partsStream(() => render(Root, props, options), options);
}

/** Streams the parts of a page from `render`: the first render whole, then what resolves later. */
export function streamParts(
  parts: RenderResult,
  options: DocumentOptions = {},
): ReadableStream<string> {
  return partsStream(() => parts, options);
}

/** A stream of the parts of a page. An error while it gets or writes them fails the stream. */
function partsStream(
  getParts: () => RenderResult | Promise<RenderResult>,
  options: DocumentOptions,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        await writeParts(await getParts(), options, controller);
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function writeParts(
  parts: RenderResult,
  options: DocumentOptions,
  controller: ReadableStreamDefaultController<string>,
): Promise<void> {
  controller.enqueue(firstRender(parts.html, parts.head, parts.state, options));
  if (parts.pending !== NOTHING_PENDING) {
    for await (const chunk of parts.pending) {
      controller.enqueue(chunk);
    }
  }
  controller.close();
}

/**
 * The message and status that answer an error. A `ServerError` sends its
 * own. Any other error is logged, and sends `fallback` with status 500.
 */
function errorAnswer(error: unknown, fallback: string): { message: string; status: number } {
  if (error instanceof ServerError) {
    return { message: error.message, status: error.status };
  }
  console.error(error);
  return { message: fallback, status: 500 };
}

/** True for a request that a `<form>` sent, without client code. */
function isFormPost(request: Request): boolean {
  const type = request.headers.get('content-type') ?? '';
  return (
    type.startsWith('application/x-www-form-urlencoded') || type.startsWith('multipart/form-data')
  );
}

/** The answer to a call or a form post from a page of another site. See `isCrossSite`. */
function crossSiteAnswer(): Response {
  return new Response('Calls from other sites are not allowed', { status: 403 });
}

/** The answer to a call or a form post to a server function that does not exist. */
function unknownAnswer(id: string): Response {
  return new Response(`Unknown server function "${id}"`, { status: 404 });
}

/**
 * Calls a server function with the data of a form that the browser sent.
 * Returns its result, or the response that answers the post instead: a
 * `redirect` in the function sends the browser there, and an error answers
 * with a short text page, because there is no page to report it in. The
 * response has `headers`. With `base`, the location of a redirect is
 * resolved against it.
 */
async function callWithForm(
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  fn: (...args: any[]) => unknown,
  request: Request,
  event: RequestEvent,
  headers: Headers,
  base?: string,
): Promise<{ result: unknown } | { answer: Response }> {
  try {
    const form = await request.formData();
    return { result: await withEvent(event, () => fn(form)) };
  } catch (error) {
    if (error instanceof Redirect) {
      headers.set('location', base ? new URL(error.location, base).href : error.location);
      return { answer: new Response(null, { status: error.status, headers }) };
    }
    const { message, status } = errorAnswer(error, 'The server function failed');
    headers.set('content-type', 'text/plain; charset=utf-8');
    return { answer: new Response(message, { status, headers }) };
  }
}

/**
 * Calls a server function with the data of a form that the browser sent, and
 * sends the browser back to the page with a redirect. The response has the
 * headers of the event, such as cookies that the function set.
 */
async function handleForm(
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  fn: (...args: any[]) => unknown,
  request: Request,
  event: RequestEvent,
): Promise<Response> {
  const { headers } = event;
  const outcome = await callWithForm(fn, request, event, headers);
  if ('answer' in outcome) {
    return outcome.answer;
  }
  headers.set('location', request.headers.get('referer') ?? '/');
  return new Response(null, { status: 303, headers });
}

/**
 * The arguments of a call. They come as seroval JSON, or as multipart form
 * data when they hold files: the JSON in `args`, and each file in
 * `file<index>`, where an `Upload` stands in the JSON.
 */
async function readArgs(request: Request): Promise<unknown[]> {
  if (!request.headers.has('x-brumate-args')) {
    return fromJSON<unknown[]>((await request.json()) as SerovalJSON, {
      plugins,
      disabledFeatures,
    });
  }
  const form = await request.formData();
  const args = fromJSON<unknown[]>(JSON.parse(String(form.get('args'))) as SerovalJSON, {
    plugins,
    disabledFeatures,
  });
  return replaceDeep(args, (value) =>
    value instanceof Upload ? (form.get(`file${value.index}`) ?? undefined) : undefined,
  ) as unknown[];
}

export interface RequestOptions {
  /**
   * Other origins that may call server functions and post forms to them,
   * such as `https://app.example.com`. The origin of the request is always
   * allowed.
   */
  origins?: string[];
}

/**
 * True when a request comes from a page of another site. Server function
 * calls and form posts send the cookies of the user, so another site must
 * not be able to make them.
 *
 * The browser sends `Origin` with every call and post. Without it, an older
 * browser's `Sec-Fetch-Site` decides. A request with neither does not come
 * from a page in a browser, so it is allowed.
 */
export function isCrossSite(request: Request, options: RequestOptions = {}): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) {
    const site = request.headers.get('sec-fetch-site');
    return site === 'cross-site' || site === 'same-site';
  }
  if (origin === 'null') {
    return true;
  }
  if (options.origins?.includes(origin)) {
    return false;
  }
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return true;
  }
  // The server can see itself under another name than the page, such as
  // `localhost` behind a proxy, so the host headers count too.
  return ![
    new URL(request.url).host,
    request.headers.get('host'),
    request.headers.get('x-forwarded-host'),
  ].includes(host);
}

/**
 * Answers a server function call from `brumate/client`. Returns undefined
 * when the request is not a call, so other handlers can answer it. Server
 * functions read the request with `getEvent()`. A call from a page of
 * another site answers 403. See `isCrossSite`.
 */
export async function handleRequest(
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  functions: Record<string, (...args: any[]) => unknown>,
  request: Request,
  prefix = '/_brumate',
  options: RequestOptions = {},
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (request.method !== 'POST' || !url.pathname.startsWith(`${prefix}/`)) {
    return undefined;
  }
  if (isCrossSite(request, options)) {
    return crossSiteAnswer();
  }
  const id = decodeURIComponent(url.pathname.slice(prefix.length + 1));
  const fn = functions[id];
  if (!fn) {
    return unknownAnswer(id);
  }
  const event = new RequestEvent(request);
  // The function runs with its event, so `getEvent()` before its first await returns it.
  const invoke = (args: unknown[]): unknown => withEvent(event, () => fn(...args));
  // A call with files sends its arguments as form data, with this header.
  if (isFormPost(request) && !request.headers.has('x-brumate-args')) {
    // The loader sends a form of an `$action` with this header, and wants the result, not a page.
    if (!request.headers.has('x-brumate-result')) {
      return handleForm(fn, request, event);
    }
    const form = await request.formData();
    return answerCall(functions, event, async () => invoke([form]));
  }
  // Arguments that fail to read, such as a regular expression, answer as an error of the call.
  return answerCall(functions, event, async () => invoke(await readArgs(request)));
}

/**
 * Answers a server function call with its result as a stream of seroval
 * chunks, so promises and async iterables in it stream as they settle. A
 * redirect is sent as a header, so the client can follow it. An error
 * answers with a message that the client throws.
 */
async function answerCall(
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  functions: Record<string, (...args: any[]) => unknown>,
  event: RequestEvent,
  run: () => Promise<unknown>,
): Promise<Response> {
  const { headers } = event;
  try {
    const result = await run();
    // The client loads again the memos that call the server functions that `refresh` named.
    const { refreshed } = event;
    if (refreshed?.size) {
      const ids = Object.keys(functions).filter((key) => refreshed.has(unwrap(functions[key])));
      if (ids.length > 0) {
        headers.set('x-brumate-refresh', ids.join(','));
      }
    }
    headers.set('content-type', STREAM_TYPE);
    return new Response(toChunkStream(result), { headers });
  } catch (error) {
    if (error instanceof Redirect) {
      headers.set('x-brumate-redirect', error.location);
      return new Response(null, { status: 204, headers });
    }
    const { message, status } = errorAnswer(error, 'The server function failed');
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
}

interface ResolvedView {
  key: string;
  component: Component;
  slots: Record<string, ResolvedView>;
  /** `_loading.brm`: the view streams in, and this shows until then. */
  loading?: Component;
}

/** Imports every module of a matched route before it renders. */
async function resolveView(view: RouteView): Promise<ResolvedView> {
  const [module, loading, ...slots] = await Promise.all([
    view.load(),
    view.loading?.(),
    ...Object.values(view.slots).map(resolveView),
  ]);
  const names = Object.keys(view.slots);
  return {
    key: view.key,
    component: module.default,
    loading: loading?.default,
    slots: Object.fromEntries(names.map((name, index) => [name, slots[index]!])),
  };
}

/**
 * Renders a view where its layout inserts it. A view with a loading file
 * streams in after the rest of the page, as a `#loading` body does.
 */
async function renderView(
  view: ResolvedView,
  props: Record<string, unknown>,
  ctx: Context,
  scope: ScopeId | undefined,
): Promise<string> {
  if (!view.loading) {
    return component(viewComponent(view, props), {}, ctx, scope);
  }
  const id = ctx.boundary();
  const fallback = await component(view.loading, props, ctx, scope);
  ctx.defer(id, (child) => component(viewComponent(view, props), {}, child, scope));
  return `<!--l${id}-->${fallback}<!--/l-->`;
}

/**
 * A component that renders a route, with its slots rendering where the
 * layout inserts them. `props` go to every view, such as `params`.
 */
function viewComponent(view: ResolvedView, props: Record<string, unknown>): Component {
  return (_props, ctx) => {
    const own: Record<string, unknown> = { ...props };
    for (const [name, slot] of Object.entries(view.slots)) {
      // Comments mark the slot, its layout's scope, the scope of its route and the route's key,
      // so the client can replace only the routes that change.
      own[name] = lazy(async (at, scope) => {
        const root = at.peek();
        const html = await renderView(slot, props, at, scope);
        return `<!--R${scope ?? -1}:${name}:${root}:${encodeURIComponent(slot.key)}-->${html}<!--/R-->`;
      });
    }
    return view.component(own, ctx);
  };
}

export interface RouteOptions extends DocumentOptions, RequestOptions {
  /**
   * Throws errors that are not a `ServerError` instead of rendering
   * `_error.brm`, so a dev server can show them, such as with `errorPage`
   * from `brumate/vite`. The Vite plugin sets it in development.
   */
  dev?: boolean;
  /** The server functions, by ID, for forms that post to a page. `virtual:brumate/routes` passes them. */
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  functions?: Record<string, (...args: any[]) => unknown>;
}

/**
 * Runs the server function that a form without scripts posted to a page, as
 * `?__action=<id>`. Returns its result for `$action`, or the response that
 * answers the post instead of the page: a redirect, or an error.
 * `handleRoute` adds the cookies of the event to that response, and no other
 * headers of the event.
 */
async function runAction(
  request: Request,
  id: string,
  options: RouteOptions,
  event: RequestEvent,
): Promise<{ actions: Map<unknown, unknown> } | { answer: Response }> {
  if (isCrossSite(request, options)) {
    return { answer: crossSiteAnswer() };
  }
  const fn = options.functions?.[id];
  if (!fn) {
    return { answer: unknownAnswer(id) };
  }
  const outcome = await callWithForm(fn, request, event, new Headers(), request.url);
  return 'answer' in outcome ? outcome : { actions: new Map([[fn, outcome.result]]) };
}

/** Renders the page of a route tree, streamed, with the results of a form for `$action`. */
async function renderPage(
  view: ResolvedView,
  props: Record<string, unknown>,
  request: Request,
  options: RouteOptions,
  extra: { actions?: Map<unknown, unknown>; status?: number },
): Promise<Response> {
  // A page that the client loads in place of another starts above its IDs.
  const base = Number(request.headers.get('x-brumate-base'));
  const defer = deferTarget(request);
  if (defer) {
    return renderDeferred(view, props, request, options, defer, base);
  }
  const parts = await render(
    viewComponent(view, props),
    {},
    {
      ...options,
      request,
      actions: extra.actions,
      route: view.key,
      base: Number.isSafeInteger(base) && base > 0 ? base : undefined,
    },
  );
  const headers = new Headers(parts.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // The same URL answers the request for a `#defer` body with that body only.
  headers.append('vary', 'x-brumate-defer');
  const body = streamParts(parts, options).pipeThrough(new TextEncoderStream());
  return new Response(body, { status: extra.status ?? parts.status, headers });
}

/**
 * The `#defer` block that a request asks for, from `x-brumate-defer:
 * <boundary> <scope>:<anchor>`, which the browser sends when the block's
 * trigger fires.
 */
function deferTarget(request: Request): { boundary: ScopeId; at: string } | undefined {
  const match = /^([\d.]+) (-?[\d.]+:\d+)$/.exec(request.headers.get('x-brumate-defer') ?? '');
  return match ? { boundary: parseId(match[1]!), at: match[2]! } : undefined;
}

/**
 * Renders the route again and answers with the body of one `#defer` block:
 * its markup in a `<template b-l>`, the script that swaps it in, and its
 * state. The page renders with the base it had, so its IDs come out the
 * same. When the block is not where the browser has it, such as after the
 * data of the page changed, the answer is 409 and the fallback stays.
 */
async function renderDeferred(
  view: ResolvedView,
  props: Record<string, unknown>,
  request: Request,
  options: RouteOptions,
  defer: { boundary: ScopeId; at: string },
  base: number,
): Promise<Response> {
  const parts = await render(
    viewComponent(view, props),
    {},
    {
      ...options,
      request,
      route: view.key,
      base: Number.isSafeInteger(base) && base > 0 ? base : undefined,
      defer,
    },
  );
  const headers = new Headers(parts.headers);
  headers.append('vary', 'x-brumate-defer');
  if (parts.defer !== 'found') {
    return new Response(null, { status: parts.defer === 'moved' ? 409 : 404, headers });
  }
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('x-brumate-defer', String(defer.boundary));
  const body = new ReadableStream<string>({
    async start(controller) {
      try {
        if (parts.pending !== NOTHING_PENDING) {
          for await (const chunk of parts.pending) {
            controller.enqueue(chunk);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  }).pipeThrough(new TextEncoderStream());
  return new Response(body, { status: parts.status, headers });
}

/**
 * Renders the first `_error.brm` that renders, from the innermost. Its
 * component gets `error`, with the message and the status.
 */
async function renderError(
  views: RouteView[],
  error: { message: string; status: number },
  params: Record<string, string>,
  request: Request,
  options: RouteOptions,
): Promise<Response | undefined> {
  for (const view of views) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- The next file renders only when this one throws.
      const resolved = await resolveView(view);
      // oxlint-disable-next-line no-await-in-loop -- The next file renders only when this one throws.
      return await renderPage(resolved, { params, error }, request, options, {
        status: error.status,
      });
    } catch (failure) {
      // An error file that throws hands the error to the one outside it.
      console.error(failure);
    }
  }
  return undefined;
}

/** Runs the middleware of the folders on the path, from the outside in, around the answer. */
async function runMiddleware(
  loaders: MiddlewareLoader[],
  request: Request,
  event: RequestEvent,
  answer: () => Promise<Response>,
): Promise<Response> {
  const [first, ...rest] = loaders;
  if (!first) {
    return answer();
  }
  const { middleware } = await first();
  return withEvent(event, () =>
    middleware(request, () => runMiddleware(rest, request, event, answer)),
  );
}

/**
 * Answers a request with the route that matches its path, streamed:
 *
 * - The `_middleware.ts` of each folder on the path runs first, from the outside in.
 * - An endpoint at the path answers the methods that it exports.
 * - A form without scripts that posts to the page with `?__action=<id>`
 *   runs that server function first, and the page renders with its result
 *   for `$action`.
 * - A route that throws renders the nearest `_error.brm`, and a path that
 *   no route matches renders the `_error.brm` of the root with status 404.
 *
 * Returns undefined when no route matches and the root has no error file or
 * middleware. A `redirect` while the page renders answers with a redirect.
 */
export async function handleRoute(
  tree: RouteNode,
  request: Request,
  options: RouteOptions = {},
): Promise<Response | undefined> {
  // One event for the request: middleware, endpoints, a form's server function and the page
  // share it, so cookies that one sets reach the response and the others read them.
  const event = options.event ?? new RequestEvent(request);
  const answer = await routeAnswer(tree, request, { ...options, event });
  return answer && withHeaders(answer, event.headers);
}

/** A response with more headers, such as cookies that middleware set. */
function withHeaders(answer: Response, headers: Headers): Response {
  // A rendered page has them already.
  const sent = new Set(answer.headers.getSetCookie());
  const cookies = headers.getSetCookie().filter((cookie) => !sent.has(cookie));
  if (cookies.length === 0) {
    return answer;
  }
  // A response can have headers that cannot change, such as one from `Response.redirect`.
  const result = new Response(answer.body, answer);
  for (const cookie of cookies) {
    result.headers.append('set-cookie', cookie);
  }
  return result;
}

async function routeAnswer(
  tree: RouteNode,
  request: Request,
  options: RouteOptions,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  const match = matchRoute(tree, url.pathname);
  if (!match) {
    const missing = notFound(tree);
    if (missing.errors.length === 0 && missing.middleware.length === 0) {
      return undefined;
    }
    return runMiddleware(missing.middleware, request, options.event!, async () => {
      const page = await renderError(
        missing.errors,
        { message: 'Not found', status: 404 },
        {},
        request,
        options,
      );
      return page ?? new Response('Not found', { status: 404 });
    });
  }
  return runMiddleware(match.middleware, request, options.event!, () =>
    answerRoute(match, request, url, options),
  );
}

/** Answers a request that a route matches, after its middleware. `url` is the URL of the request. */
async function answerRoute(
  match: RouteMatch,
  request: Request,
  url: URL,
  options: RouteOptions,
): Promise<Response> {
  if (match.endpoint) {
    const endpoint = await match.endpoint();
    const handler =
      endpoint[request.method] ?? (request.method === 'HEAD' ? endpoint.GET : undefined);
    if (handler) {
      return withEvent(options.event, () => handler(request, match.params));
    }
    if (match.view.load === missingPage || request.method !== 'GET') {
      const allow = Object.keys(endpoint).filter((name) => /^[A-Z]+$/.test(name));
      return new Response('Method not allowed', {
        status: 405,
        headers: { allow: allow.join(', ') },
      });
    }
  }
  let actions: Map<unknown, unknown> | undefined;
  const posted = url.searchParams.get('__action');
  if (request.method === 'POST' && posted !== null) {
    const outcome = await runAction(request, posted, options, options.event!);
    if ('answer' in outcome) {
      return outcome.answer;
    }
    actions = outcome.actions;
  }
  try {
    const view = await resolveView(match.view);
    return await renderPage(view, { params: match.params }, request, options, { actions });
  } catch (error) {
    if (isRedirect(error)) {
      return new Response(null, {
        status: error.status,
        headers: { location: new URL(error.location, url).href },
      });
    }
    if (options.dev && !(error instanceof ServerError)) {
      throw error;
    }
    const page = await renderError(
      match.errors,
      errorAnswer(error, 'Something went wrong'),
      match.params,
      request,
      options,
    );
    if (page) {
      return page;
    }
    throw error;
  }
}

/**
 * Renders an object of attributes. A handler in it, such as an `onClick`
 * that a component passes on with `...rest`, goes into `on` as a `b-on`
 * entry: the client function that it refers to, with the scope that the
 * function belongs to and the modifiers of its wrappers. A function that
 * refers to nothing in the browser is left out.
 */
export function spread(attributes: Record<string, unknown>, on?: string[]): string {
  // The `b-on` of a dynamic tag that names a component reaches the component as a prop, and
  // its handlers come first, as the element's own.
  const entries = on && attributes['b-on'];
  if (typeof entries === 'string') {
    on!.unshift(entries);
    const { 'b-on': _, ...rest } = attributes;
    return spread(rest, on);
  }
  for (const [name, value] of Object.entries(attributes)) {
    const reference =
      on && /^on[A-Z]/.test(name) && typeof value === 'function'
        ? functionReferences.get(value)
        : undefined;
    if (reference) {
      const modifiers = (value as { [MODIFIERS]?: string[] })[MODIFIERS] ?? [];
      on!.push(
        `${[name.slice(2).toLowerCase(), ...modifiers].join(':')}=${reference.ref}@${reference.scope}`,
      );
    }
  }
  return spreadAttributes(attributes);
}

/** The `b-on` attribute of an element with spreads: its own handlers, then those of its spreads. */
export function onAttribute(on: string[], own: string): string {
  const value = [own, ...on].filter(Boolean).join(' ');
  return value ? ` b-on="${escapeAttribute(value)}"` : '';
}
