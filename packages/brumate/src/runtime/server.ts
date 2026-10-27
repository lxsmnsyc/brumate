import { crossSerialize, crossSerializeStream, fromJSON } from 'seroval';
import type { SerovalJSON } from 'seroval';
import { cacheStore, tagVersions } from './cache.ts';
import {
  VOID_ELEMENTS,
  actionAttributes,
  escape,
  escapeAttribute,
  bindEntry,
  handlerEntry,
  insertValue,
  isRaw,
  onAttribute,
  rawHTML,
  ownValue,
  spread as spreadAttributes,
  styleElement,
} from './html.ts';
import { MODIFIERS } from './events.ts';
import type { Raw } from './html.ts';
import { callPlugins, serialOptions, plugins, syncPlugins } from './serial.ts';
import { serverSecrets } from './secrets.ts';
import {
  Binding,
  CHILDREN,
  CHILDREN_REF,
  ChildrenReference,
  ElementReference,
  FunctionReference,
  ITEM,
  ITEM_SLOT,
  MODULE,
  OWNER,
  PARTS,
  PREFIX,
  SOURCE,
  SlotReference,
  addEntryHandlers,
  isAsyncIterable,
  isBinding,
  isSlotReference,
  parseId,
} from './shared.ts';
import { functionReferences } from './calls.ts';
import { STREAM_TYPE, toChunkStream } from './stream.ts';
import type { PackedState, PageState, ScopeId, ScopeState } from './shared.ts';
import {
  Redirect,
  RequestEvent,
  ServerError,
  idempotentIds,
  isRedirect,
  runEntry,
  unwrap,
  withEvent,
} from './request.ts';
import type { EntryMiddleware, RequestKind, TraceEntry } from './request.ts';
import type { Context as ContextValue } from './context.ts';

export {
  affix,
  attribute,
  classAttribute,
  escape,
  escapeAttribute,
  internal,
  mergeAttributes,
  raw,
  vars,
} from './html.ts';
export type { Raw } from './html.ts';
export { produce } from './produce.ts';
export { createContext, navigationContext, routeContext } from './context.ts';
export type { NavigationState, Route } from './context.ts';
import { ROUTE_KEY } from './context.ts';
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
  defineMiddleware,
  getEvent,
  isRedirect,
  redirect,
  withEvent,
} from './request.ts';
export type {
  EntryMiddleware,
  Locals,
  Redirect,
  RequestCall,
  RequestEventOptions,
  RequestKind,
} from './request.ts';
export { ValidationError, fieldErrors, parse, parseForm, safeParse } from './validate.ts';
export { parseSubmission } from './submission.ts';
export type {
  FailedSubmission,
  IntentSubmission,
  ReplyOptions,
  Submission,
  SubmissionOptions,
  SuccessfulSubmission,
} from './submission.ts';
export type { Intent, SubmissionResult } from './forms.ts';
export { RateLimitError, clientAddress, configureRateLimit, rateLimit } from './rate-limit.ts';
export type {
  RateLimit,
  RateLimitConfig,
  RateLimitMiddleware,
  RateLimitOptions,
  RateLimitStore,
  Window,
} from './rate-limit.ts';
export type { ParseResult, ValidationIssue } from './validate.ts';
export type { StandardSchemaV1 } from './standard-schema.ts';
export { createSession, parseCookies, serializeCookie, toNodeHeaders } from './cookies.ts';
export { cached, memoryStore, revalidate, setCacheStore, storageStore } from './cache.ts';
export { useSerialEntry } from './shared.ts';
export { idempotent } from './idempotent.ts';
export type { IdempotentOptions } from './idempotent.ts';
export type { CachedOptions, CacheStore } from './cache.ts';
export type { CookieOptions, Session, SessionOptions } from './cookies.ts';
export { ElementReference, FunctionReference };
export { unbind } from './shared.ts';

/** What `$bind(name)` passes a child: the value of the name, and the scope and slot it writes. */
export function binding<T>(value: T, scope: ScopeId, slot: number, set?: unknown): Binding<T> {
  return new Binding(value, new SlotReference(scope, slot), set);
}
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
  /** The `#reveal` group that orders it, when it is in one. */
  group?: RevealGroup;
}

/** The order of a `#reveal` block. */
export type RevealOrder = 'sequential' | 'backwards' | 'together' | 'natural';

/**
 * The `#loading` bodies of a `#reveal` block, in the order of the markup.
 * When a body is ready, the stream asks the group, which sends the bodies
 * that its order lets show. The data of every body still loads at once.
 */
class RevealGroup {
  readonly order: RevealOrder;
  readonly collapsed: boolean;
  /** The bodies that stream, each with how to send it once it is ready. */
  private readonly members: { id: ScopeId; send?: (after: string) => void; sent?: boolean }[] = [];
  /** The fallbacks that `collapsed` hides until the body before them shows. */
  readonly hidden: Set<ScopeId> = new Set();
  private closed = false;

  constructor(order: RevealOrder, collapsed: boolean) {
    this.order = order;
    this.collapsed = collapsed;
  }

  /** True when a body that is ready can render in place, before the bodies that stream. */
  mayShow(): boolean {
    return this.order === 'natural' || (this.order === 'sequential' && this.members.length === 0);
  }

  /** True when the fallback of the next body that streams waits, for `collapsed`. */
  hides(): boolean {
    return this.collapsed && this.members.length > 0;
  }

  add(id: ScopeId): void {
    this.members.push({ id });
  }

  /** The body is ready, or failed with nothing to send. `send` writes it, and runs `after` with it. */
  ready(id: ScopeId, send: (after: string) => void): void {
    const member = this.members.find((item) => item.id === id);
    if (member) {
      member.send = send;
      this.flush();
    } else {
      send('');
    }
  }

  /** The block ended, so the group knows its last body. */
  close(): void {
    this.closed = true;
    this.flush();
  }

  private flush(): void {
    const { members } = this;
    const sendAt = (index: number): void => {
      const member = members[index]!;
      member.sent = true;
      // `collapsed`: the body that shows brings the fallback of the next one in.
      const next = members[index + 1];
      member.send!(next && this.hidden.has(next.id) ? `$bF(${scriptJSON(next.id)})` : '');
    };
    if (this.order === 'natural') {
      members.forEach((member, index) => member.send && !member.sent && sendAt(index));
    } else if (this.order === 'sequential') {
      for (let index = 0; index < members.length && members[index]!.send; index++) {
        if (!members[index]!.sent) {
          sendAt(index);
        }
      }
    } else if (this.closed && this.order === 'backwards') {
      for (let index = members.length - 1; index >= 0 && members[index]!.send; index--) {
        if (!members[index]!.sent) {
          sendAt(index);
        }
      }
    } else if (this.closed && members.every((member) => member.send)) {
      members.forEach((member, index) => !member.sent && sendAt(index));
    }
  }
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
  /** The number of the first scope, and the scopes from there on, so an ID finds its scope. */
  first: number;
  entries: (ScopeEntry | undefined)[];
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

/** A scope of a render: its record, and what the server keeps of it while the page renders. */
export interface ScopeEntry {
  id: ScopeId;
  /** The prefix of the ID and the number after it, such as `'5.'` and `1`, or `''` and `3`. */
  prefix: string;
  n: number;
  record: ScopeState;
  /** The render whose state holds the record. */
  ctx: Context | undefined;
  /** The ID space that finds the scope by its ID, for a scope that `scope()` made. */
  space?: IdSpace;
  /** The scope that the contexts of this one are found in. */
  parent?: ScopeId;
  /** The values of contexts that this scope provides. */
  values?: Map<string, unknown>;
  /** The names of the slots, so an error can name a value that cannot be sent. */
  names?: string[];
  /** The scope and the slot that hold the list of this list item. */
  source?: ItemSource;
}

/**
 * Tracks the scopes of one render. A `#loading` body renders in a child
 * context, so its scopes are written with its markup.
 */
export class Context {
  /**
   * The scopes of this render, in the order it made them, with their
   * records. A record that this render adds to a scope of another render,
   * such as a link from a `#loading` body to a scope of the page, is here
   * too, as a scope of its own.
   */
  readonly scopes: ScopeEntry[] = [];
  /**
   * Every ID space of the page, across the renders of `#loading` bodies, on
   * the root context. A scope is found by its ID in the entries of its space.
   * The spaces are put in a map by prefix only when a scope is looked up
   * outside the blocks that are open, since a render makes many and looks
   * up few, and each string key costs a hash.
   */
  private readonly made: IdSpace[] = [];
  private byPrefix: Map<string, IdSpace> | undefined;
  private indexed = 0;
  /** The records that this render adds to scopes of other renders, by ID. */
  private partials: Map<ScopeId, ScopeEntry> | undefined;
  /** The scope that the render used last, since it uses one a few times in a row. */
  private last: ScopeEntry | undefined;
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
  /** The titles that this render set, and whether they all came from a `<title>` in `#head`. */
  private titles = { count: 0, markup: true };
  private onBoundary: ((boundary: Boundary) => void) | undefined;
  /** The scope that renders the next component, which becomes its owner. */
  private owner: ScopeId | undefined;
  /**
   * Children that render where they are inserted: the scope of the markup
   * that wrote them, and the scope where they are, for their contexts.
   */
  private readonly inserted: { from: ScopeId; at: ScopeId; tag?: string }[] = [];
  /** Takes back what this context added to the page, from the newest, for `restore`. */
  private readonly undo: (() => void)[] = [];

  /** The URL prefix of server function calls. */
  private rpcPrefix = '/_brumate';
  /** The ID of the build, for forms that post to server functions. See `RenderOptions`. */
  build: string | undefined;

  /** Results of server functions that a form posted to this page, for `$action`. */
  actions: Map<unknown, unknown> = new Map();
  /** The params of the route of the page, for `$route`. */
  params: Record<string, string> = {};
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

  /** Starts an entry of the trace of the request, in development. */
  traced(kind: TraceEntry['kind'], label: string): ((failed?: boolean) => void) | undefined {
    return this.root.event?.traced(kind, label);
  }

  /** Marks the request of the page as one that depends on the user, so the page is not cached for everyone. */
  personal(): void {
    if (this.root.event) {
      this.root.event.personal = true;
    }
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
    const first = prefix ? 0 : base;
    this.spaces = [{ prefix, scope: first, boundary: first, first, entries: [] }];
    this.root.made.push(this.spaces[0]!);
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
   * block takes, until `leave`. A `#loading` body that renders in place
   * passes the ID of its boundary, so its scopes get the IDs that they
   * would get in a stream.
   */
  enter(id: ScopeId = spaceId(this.space, this.space.boundary++)): void {
    const space: IdSpace = { prefix: `${id}.`, scope: 0, boundary: 0, first: 0, entries: [] };
    this.spaces.push(space);
    this.root.made.push(space);
  }

  /** Ends the block that `enter` started. */
  leave(): void {
    this.spaces.pop();
  }

  /** Returns the URL prefix of server function calls. */
  rpc(): string {
    return this.root.rpcPrefix;
  }

  /** Returns the ID of the build, when the render has one. */
  buildId(): string | undefined {
    return this.root.build;
  }

  /**
   * Returns a new scope ID. `kind` is the scope's ID in the compiled
   * component, `parent` is the scope that contains it, and `module` is the
   * component ID of a component's root scope.
   */
  scope(kind: number, parent?: ScopeId, module?: string): ScopeId {
    const root = this.root;
    const space = this.space;
    const n = space.scope++;
    const id = space.prefix ? `${space.prefix}${n}` : n;
    const record: ScopeState = {};
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
    const entry: ScopeEntry = { id, prefix: space.prefix, n, record, ctx: this, parent: up, space };
    this.scopes.push(entry);
    space.entries.push(entry);
    this.last = entry;
    return id;
  }

  /** The scope of the page with an ID, from any render. */
  private find(id: ScopeId): ScopeEntry | undefined {
    const root = this.root;
    if (typeof id === 'number') {
      const page = root.made[0]!;
      return page.entries[id - page.first];
    }
    const dot = id.lastIndexOf('.');
    let n = 0;
    for (let i = dot + 1; i < id.length; i++) {
      n = n * 10 + id.charCodeAt(i) - 48;
    }
    // The scope is usually in a block that is still open, such as the item of a list.
    for (let i = this.spaces.length - 1; i >= 0; i--) {
      const space = this.spaces[i]!;
      if (space.prefix.length === dot + 1 && id.startsWith(space.prefix)) {
        return space.entries[n - space.first];
      }
    }
    const byPrefix = (root.byPrefix ??= new Map());
    for (; root.indexed < root.made.length; root.indexed++) {
      const space = root.made[root.indexed]!;
      byPrefix.set(space.prefix, space);
    }
    const space = byPrefix.get(id.slice(0, dot + 1));
    return space?.entries[n - space.first];
  }

  /**
   * Renders children where a component inserts them, at `at`. Their scopes
   * keep `from`, the scope of the markup that wrote them, for their values,
   * and find their contexts from `at`.
   */
  async children(
    from: ScopeId,
    at: ScopeId,
    renderBody: () => Promise<string>,
    tag?: string,
  ): Promise<string> {
    const { inserted } = this.root;
    // Children that a component passes on, as `<Select>{children}</Select>`, render where the
    // component that gets them inserts them, so they find their contexts there too.
    const outer = inserted.findLast((item) => item.from === at);
    const entry = { from, at: outer ? outer.at : at, tag: tag ?? outer?.tag };
    if (outer) {
      // The browser finds the component that holds these children by this.
      const passing = this.find(at);
      if (passing) {
        passing.record.f = outer.at;
      }
    }
    inserted.push(entry);
    try {
      return await renderBody();
    } finally {
      inserted.splice(inserted.indexOf(entry), 1);
    }
  }

  /** The tag of the element where the children that render now are inserted, for spacers. */
  spacerTag(): string {
    return this.root.inserted.at(-1)?.tag ?? 'div';
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
    const node = this.find(scope)!;
    node.values ??= new Map();
    node.values.set(context.key, value);
    const record = this.record(scope);
    record.v ??= {};
    record.v[context.key] = value;
  }

  /**
   * Reads a context from the nearest scope above `scope` that provides it.
   * With `slot`, records which slot holds it, so the client can update it
   * when the provided value changes.
   */
  consume<T>(context: ContextValue<T>, scope: ScopeId, slot?: number): T {
    if (slot !== undefined) {
      const record = this.record(scope);
      record.x ??= {};
      record.x[context.key] = slot;
    }
    // A scope reads the contexts of the scopes above it, not its own, so a component can read a
    // context and provide it again to the scopes inside it.
    for (let id: ScopeId | undefined = this.find(scope)?.parent; id !== undefined;) {
      const node = this.find(id);
      if (node?.values?.has(context.key)) {
        return node.values.get(context.key) as T;
      }
      id = node?.parent;
    }
    // The route of the page comes from its request and the params of its route.
    if (context.key === ROUTE_KEY) {
      const url = new URL(this.root.event?.request.url ?? 'http://localhost/');
      return { url, search: url.searchParams, params: this.root.params } as T;
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
    this.last = undefined;
    // The scopes are kept in place, since a spread of a long list would pass too many arguments.
    const { scopes } = this;
    let kept = 0;
    for (const entry of scopes) {
      if (!madeAfter(mark, entry.id)) {
        scopes[kept++] = entry;
        continue;
      }
      const { space } = entry;
      if (space?.entries[entry.n - space.first] === entry) {
        space.entries[entry.n - space.first] = undefined;
      }
      this.partials?.delete(entry.id);
    }
    scopes.length = kept;
  }

  /** The scope of this render with an ID, or the record that this render adds to another's. */
  private entry(scope: ScopeId): ScopeEntry {
    const last = this.last;
    if (last && last.id === scope) {
      return last;
    }
    let entry = this.find(scope);
    if (entry?.ctx !== this) {
      this.partials ??= new Map();
      entry = this.partials.get(scope);
      if (!entry) {
        const [prefix, n] = splitId(scope);
        entry = { id: scope, prefix, n, record: {}, ctx: this };
        this.partials.set(scope, entry);
        this.scopes.push(entry);
      }
    }
    this.last = entry;
    return entry;
  }

  private record(scope: ScopeId): ScopeState {
    return this.entry(scope).record;
  }

  /** The record of a scope in the state of this render, if it is there. */
  ownRecord(scope: ScopeId): ScopeState | undefined {
    const entry = this.find(scope);
    return entry?.ctx === this ? entry.record : this.partials?.get(scope)?.record;
  }

  /** The records of the scopes of this render, by ID, in the order the render made them. */
  get state(): StateMap {
    return new Map(this.scopes.map((entry) => [entry.id, entry.record]));
  }

  /**
   * The list of each list item scope whose list is a slot of an enclosing
   * scope, as `[scope, slot]`. The items of a list share one array.
   */
  get sources(): Map<ScopeId, ItemSource> {
    return new Map(
      this.scopes.flatMap((entry) => (entry.source ? [[entry.id, entry.source] as const] : [])),
    );
  }

  slots(scope: ScopeId, values: unknown[], names?: string[]): void {
    const entry = this.entry(scope);
    entry.record.s = values;
    if (names) {
      entry.names = names;
    }
    // Elements that components forwarded to a signal of this scope, which rendered before it.
    const forwarded = this.forwards?.get(scope);
    if (forwarded) {
      this.forwards!.delete(scope);
      for (const [slot, value] of forwarded) {
        values[slot] = value;
      }
    }
  }

  /** Elements that bound props of components forwarded to the slots of scopes that have no slots yet. */
  private forwards?: Map<ScopeId, Map<number, ElementReference>>;

  /**
   * Writes the element that a component forwards to a slot of a scope above it, and on through
   * the props that scope binds in turn. The parent records its slots after its children render,
   * so a write for a scope that has none waits for them.
   */
  private forward(target: SlotReference, value: ElementReference): void {
    const record = this.ownRecord(target.scope);
    if (!record?.s) {
      const waiting = ((this.forwards ??= new Map()).get(target.scope) ?? new Map()) as Map<
        number,
        ElementReference
      >;
      waiting.set(target.slot, value);
      this.forwards.set(target.scope, waiting);
      return;
    }
    record.s[target.slot] = value;
    const next = (record.b as Record<number, unknown> | undefined)?.[target.slot];
    if (isSlotReference(next)) {
      this.forward(next, value);
    }
  }

  /**
   * Records the props that a parent bound with `$bind`, among the props that
   * the component writes: `slots` has the slot of each, by its name. Its
   * writes in the browser go to the parent's slots.
   */
  bindings(scope: ScopeId, props: Record<string, unknown>, slots: Record<string, number>): void {
    for (const [name, slot] of Object.entries(slots)) {
      const value = props[name];
      if (isBinding(value)) {
        const record = this.entry(scope).record;
        (record.b ??= {})[slot] = value.target;
        // An element that the component wrote into its prop goes to the signal that it is bound to.
        const written = record.s?.[slot];
        if (written instanceof ElementReference && isSlotReference(value.target)) {
          this.forward(value.target, written);
        }
      }
    }
  }

  /**
   * Records the item of a list that can change on the client. `source` is
   * the scope and slot that hold the list, when the compiler found one, so
   * the client can take the item from there.
   */
  item(scope: ScopeId, value: unknown, source?: ItemSource): void {
    const entry = this.entry(scope);
    entry.record.i = value;
    if (source) {
      entry.source = source;
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

  /**
   * A `ref` that the rest props of a component hold is a binding of a signal above. The element
   * that spreads them goes to that signal, as when the component names `ref` itself.
   */
  restRef<T extends Record<string, unknown>>(
    attributes: T,
    scope: ScopeId,
    anchor: number,
    tag?: unknown,
  ): T {
    const value = attributes.ref;
    if (typeof tag !== 'function' && isBinding(value) && isSlotReference(value.target)) {
      this.forward(value.target, new ElementReference(scope, anchor));
    }
    return attributes;
  }

  /** Returns the reference that a `ref` signal holds on the server. */
  element(scope: ScopeId, anchor: number): ElementReference {
    return new ElementReference(scope, anchor);
  }

  /**
   * Marks a function as a client function, so it serializes as a reference.
   * `args` are the arguments of a handler that `$handler` made, which go
   * with the reference. Each call makes a new reference, so a function that
   * `$handler` marks gets a copy for its arguments.
   */
  fn<T>(value: T, ref: string, scope: ScopeId, args?: unknown[]): T {
    if (typeof value !== 'function') {
      return value;
    }
    if (args === undefined && /#t\d/.test(ref)) {
      // A `#template` renders where the component that gets it inserts it, so it reads the
      // contexts there, as children do.
      const render = value as unknown as (...rest: unknown[]) => Promise<unknown>;
      const template = (...rest: unknown[]): Lazy =>
        new Children(scope, async () => {
          const html = await render(...rest);
          return isRaw(html) ? rawHTML(html) : insertValue(html);
        });
      functionReferences.set(template, new FunctionReference(ref, scope));
      return template as T;
    }
    if (args === undefined) {
      functionReferences.set(value, new FunctionReference(ref, scope));
      return value;
    }
    const bound = Object.assign((...rest: unknown[]) => value(...args, ...rest), value) as T &
      object;
    functionReferences.set(bound, new FunctionReference(ref, scope, args));
    return bound;
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

  /**
   * Sets the title of the page. The last call wins. `markup` is true for a
   * `<title>` in `#head`, which is in the head already.
   */
  title(value: unknown, markup = false): void {
    const target = this.root.sent ? this : this.root;
    const previous = target.pageTitle;
    const titles = { ...target.titles };
    const title = value === null || value === undefined ? '' : String(value);
    target.pageTitle = title;
    target.titles = { count: titles.count + 1, markup: titles.markup && markup };
    this.undo.push(() => {
      if (target.pageTitle === title) {
        target.pageTitle = previous;
        target.titles = titles;
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
    // One `<title>` in `#head` is the title of the head itself. With more, the head gets the
    // last one first, so a reader without scripts sees it.
    const { count, markup } = this.root.titles;
    const title =
      this.root.pageTitle === undefined || (count === 1 && markup)
        ? ''
        : `<title>${escape(this.root.pageTitle)}</title>`;
    return title + this.root.heads.join('');
  }

  /** Adds the markup of a `#portal` block, which goes after the rest of the page. */
  portal(html: string): void {
    this.portals.push(html);
    this.undo.push(() => removeLast(this.portals, html));
  }

  /** Adds the head markup and the title of a body that renders in place, to the head of the page. */
  adoptHead(late: { html: string; title: string | undefined }): void {
    if (late.html) {
      this.root.heads.push(late.html);
    }
    if (late.title !== undefined) {
      this.root.pageTitle = late.title;
    }
  }

  /** True when the bodies of `#defer` blocks render in place, for a page that renders in order. */
  inOrder = false;

  /** The `#reveal` blocks that are open in this context, the innermost last. */
  private readonly reveals: RevealGroup[] = [];

  /** Starts a `#reveal` block: the `#loading` bodies until `revealEnd` show in its order. */
  revealStart(order: RevealOrder, collapsed: boolean): void {
    const group = new RevealGroup(order, collapsed);
    this.reveals.push(group);
    // A `#try` body that fails ends the block, so the bodies that it held are sent.
    this.undo.push(() => group.close());
  }

  /** Ends the `#reveal` block that `revealStart` started. */
  revealEnd(): void {
    this.reveals.pop()?.close();
  }

  /** The group of the `#reveal` block around the next body, when the stream orders it. */
  private get reveal(): RevealGroup | undefined {
    return this.root.target ? undefined : this.reveals.at(-1);
  }

  /** True when a `#loading` body that is ready can render in place, as its `#reveal` allows. */
  mayShow(): boolean {
    return this.reveal?.mayShow() ?? true;
  }

  /** Starts the fallback of a `#loading` body, which `collapsed` hides in a template. */
  fallbackStart(id: ScopeId): string {
    const group = this.reveal;
    if (!group?.hides()) {
      return '';
    }
    group.hidden.add(id);
    return `<template b-f="${id}">`;
  }

  /** Ends the fallback that `fallbackStart` started. */
  fallbackEnd(id: ScopeId): string {
    return this.reveal?.hidden.has(id) ? '</template>' : '';
  }

  /** Returns the ID of a new `#loading` boundary. */
  boundary(): ScopeId {
    return spaceId(this.space, this.space.boundary++);
  }

  /** Renders a `#loading` body after the rest of the page, in its own context and ID space. */
  defer(id: ScopeId, renderBody: (ctx: Context) => Promise<string>): void {
    const target = this.root.target;
    if (!target || this.inTarget) {
      // A block in the markup of a `#reveal`, or in a component that it renders, joins its group.
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
    // A reader that runs no scripts never fires the trigger, so the body renders with the page.
    if (!target && this.root.inOrder) {
      this.register(id, renderBody, false);
      return;
    }
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
    const group = this.reveal;
    group?.add(id);
    const end = around ? undefined : this.traced('body', `#loading ${id}`);
    const boundary: Boundary = {
      id,
      render: renderBody(child).then(
        (html) => {
          end?.();
          return { html, ctx: child };
        },
        (error: unknown) => {
          end?.(true);
          throw error;
        },
      ),
      around,
      group,
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
  /** The name of the memo, for the trace of the devtools. */
  name?: string;
}

/** Declares a memo. Its value is computed when it is first read. */
export function memo<T>(compute: () => T, ctx?: Context, name?: string): Memo<T> {
  return { compute, ctx, state: 'idle', name };
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
    // A memo that loads is a step of the render, in the trace of the devtools.
    const end = node.ctx?.traced('memo', node.name ?? 'memo');
    node.load = Promise.resolve(value)
      .then(firstValue)
      .finally(() => end?.())
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

/**
 * The value of a memo for the page state: its value when it is ready, or
 * a promise of it while it loads. A memo that fails gives a rejected
 * promise either way, so the page renders and the failure reaches the
 * browser as the load that failed.
 */
export function stateValue(node: Memo): unknown {
  try {
    return read(node);
  } catch (error) {
    return error instanceof NotReady ? wait(node) : Promise.reject(error);
  }
}

/**
 * Starts every memo of a run of declarations that the render waits for,
 * so they load at the same time. Returns a promise that settles when all
 * of them have, or undefined when none is loading. A memo that fails
 * throws here, or rejects the promise.
 */
export function waitAll(nodes: Memo[]): Promise<unknown> | undefined {
  const loads: Promise<unknown>[] = [];
  for (const node of nodes) {
    const value = ready(node);
    if (value instanceof Promise) {
      loads.push(value);
    }
  }
  return loads.length === 0 ? undefined : Promise.all(loads);
}

/**
 * True when every memo has its value, so a `#loading` body that reads them
 * can render in place. A memo that is not computed yet computes here, so
 * the loads of the memos that are not ready start now, and the body that
 * streams later finds them loading. A memo that failed counts as not ready:
 * the body streams, and throws where it reads the memo.
 */
export function settled(nodes: Memo[]): boolean {
  let result = true;
  for (const node of nodes) {
    try {
      read(node);
    } catch {
      result = false;
    }
  }
  return result;
}

const LAZY: unique symbol = Symbol.for('brumate.lazy');

/** Markup that renders where it is inserted, so it can read the contexts there. */
export interface Lazy {
  [LAZY]: (
    ctx: Context,
    scope: ScopeId | undefined,
    tag?: string,
    anchor?: number,
  ) => Promise<string>;
}

/**
 * The children of a component, which render where the component inserts
 * them, so they read the contexts that the component provides. `from` is the
 * scope of the markup that wrote them.
 */
export function children(
  from: ScopeId,
  renderBody: (ctx: Context) => Promise<string>,
  ref?: string,
): Lazy {
  return new Children(from, renderBody, ref);
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
  readonly [LAZY]: Lazy[typeof LAZY];
  /** The HTML of the first render, under the symbol of raw HTML. */
  [RAW]?: string;
  /**
   * The export that renders the children in the browser, which the page state sends in place of
   * their HTML. Each insert in the browser then renders them with new scopes.
   */
  [CHILDREN_REF]?: ChildrenReference;

  constructor(from: ScopeId, renderBody: (ctx: Context) => Promise<string>, ref?: string) {
    if (ref !== undefined) {
      this[CHILDREN_REF] = new ChildrenReference(ref, from);
    }
    this[LAZY] = async (ctx, at, tag, anchor) => {
      // The browser keeps what the server rendered at this insert, when it reads the page later.
      const reference = this[CHILDREN_REF];
      if (reference && reference.at === undefined && anchor !== undefined) {
        reference.at = at;
        reference.anchor = anchor;
      }
      const html = await (at === undefined
        ? renderBody(ctx)
        : ctx.children(from, at, () => renderBody(ctx), tag));
      if (ref === undefined) {
        this[RAW] ??= html;
      }
      return html;
    };
  }
}

/**
 * The tag of the spacers of a windowed list in children: a row in a table body, an item in a
 * list, as the element where the children are inserted says, or else a `div`.
 */
export function spacerTag(ctx: Context): string {
  return ctx.spacerTag();
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
  // The key goes to one visitor, so the page is not cached for everyone.
  let key: string | undefined;
  if (idempotentIds.has(id)) {
    key = crypto.randomUUID();
    ctx.personal();
  }
  return actionAttributes(ctx.rpc(), name, id, method, result, ctx.buildId(), key);
}

/**
 * The result of a server function that a form posted to this page, for
 * `$action`, or undefined when the page was not rendered for a post.
 */
export function actionResult(ctx: Context, fn: unknown): unknown {
  return ctx.actionResult(fn);
}

/**
 * Renders a value inserted in markup. `ctx`, `scope` and `anchor` are where it
 * is inserted, for markup that renders there.
 */
export function insert(
  value: unknown,
  ctx?: Context,
  scope?: ScopeId,
  tag?: string,
  anchor?: number,
): string | Promise<string> {
  // A value that is ready renders without a promise, because most inserts are plain text.
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  ) {
    return Promise.resolve(value).then((resolved) => insert(resolved, ctx, scope, tag, anchor));
  }
  if (isLazy(value) && ctx) {
    return value[LAZY](ctx, scope, tag, anchor);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => insert(item, ctx, scope, tag));
    return parts.every((part) => typeof part === 'string')
      ? parts.join('')
      : Promise.all(parts).then((all) => all.join(''));
  }
  return insertValue(value);
}

// A compiled component answers a string. Its type is `Markup` of brumate/elements, an object type
// that a string stands in for. The bundle cannot import that type without a copy of its own.
// oxlint-disable-next-line typescript/no-explicit-any -- Components take any props.
export type Component<P = any> = (props: P, ctx: Context) => Promise<string | object>;

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
  // Children that the browser renders itself need no HTML from the server.
  if (!(given instanceof Children) || given[CHILDREN_REF]) {
    return Child(props, ctx) as Promise<string>;
  }
  // Children that the component did not insert render after it, inside its root scope, so the
  // page state has their HTML for the browser.
  const root = ctx.peek();
  return (Child(props, ctx) as Promise<string>).then(async (html) => {
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
  ref?: unknown,
): string | Promise<string> {
  if (typeof tag === 'function') {
    // The binding of `ref`, which the component forwards to its element.
    if (ref !== undefined) {
      attributes = { ...attributes, ref };
    }
    // The anchor links the component to the tag, so updates reach its props. It is no prop.
    const { 'b-b': bound, 'b-on': entries, ...passed } = attributes;
    // The handlers of the tag reach the component as `onClick` props that refer to the client
    // functions, as those of a component written by name do. A `b-on` that a live rest held
    // would not go to the browser. A handler of the same event that a rest prop passed on is
    // merged with them.
    addEntryHandlers(passed, entries, scope, (reference) => {
      const handler = Object.assign(
        () => {},
        reference.modifiers ? { [MODIFIERS]: reference.modifiers } : {},
      );
      functionReferences.set(handler, reference);
      return handler;
    });
    return component(
      tag,
      content ? { ...passed, children: content } : passed,
      ctx,
      scope,
      bound === undefined ? undefined : Number((ownValue('b-b', bound) as string).split(':')[1]),
    );
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
  let items: unknown[] = [];
  if (value instanceof Map) {
    items = [...value.keys(), ...value.values()];
  } else if (value instanceof Set) {
    items = [...value];
  } else if (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype) {
    items = Object.values(value);
  }
  return items.some((item) => holds(item, target, seen));
}

/**
 * The error of a value in the state of a page that cannot be sent to the
 * browser, which names the value and its component.
 */
function unsendable(error: unknown, ctx: Context): Error {
  const secret = secretErrors.get(error as Error);
  const target = secret ?? (error as { value?: unknown }).value;
  if (target === undefined) {
    return error instanceof Error ? error : new Error(String(error));
  }
  for (const { record, names } of ctx.scopes) {
    const index = (record.s ?? []).findIndex((value) => holds(value, target));
    if (index === -1) {
      continue;
    }
    let owner: ScopeState | undefined = record;
    while (owner && owner.m === undefined && owner.p !== undefined) {
      owner = ctx.ownRecord(owner.p);
    }
    const name = names?.[index] ?? `slot ${index}`;
    if (secret !== undefined) {
      return new Error(
        `The value of "${name}" in ${owner?.m ?? 'a component'} is the value of a server environment variable, and code that runs in the browser reads it. Read the variable in a server function, and send the browser only what it needs.`,
      );
    }
    const kind = (target as object)?.constructor?.name ?? typeof target;
    return new Error(
      `The value of "${name}" in ${owner?.m ?? 'a component'} holds a ${kind}, which cannot be sent to the browser, and code that runs in the browser reads it. Use it in a server function, or create it in the browser, such as in $client.`,
      { cause: error },
    );
  }
  return error instanceof Error ? error : new Error(String(error));
}

/** The secret that each error of `secretError` found. The error does not hold it, so a log does not show it. */
const secretErrors = new WeakMap<Error, string>();

/** The code of each secret as seroval writes a string: in double quotes, escaped. */
const secretCode = new Map<string, string>();

/**
 * An error for a record of the page state that holds the value of a server
 * environment variable as a string, or undefined. A record holds a string
 * as its code in quotes, so this is one search of the code per secret.
 */
function secretError(code: string): Error | undefined {
  for (const secret of serverSecrets()) {
    let literal = secretCode.get(secret);
    if (literal === undefined) {
      literal = crossSerialize(secret);
      secretCode.set(secret, literal);
    }
    if (code.includes(literal)) {
      const error = new Error(
        'The page state holds the value of a server environment variable, which is not sent to the browser',
      );
      secretErrors.set(error, secret);
      return error;
    }
  }
  return undefined;
}

/** JSON that is safe in a `<script>`, with each `<` escaped. */
function scriptJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** The fields that a record in a group of `PackedState` can have. */
const PACKED_FIELDS = new Set(['k', 'p', 'o', 'm', 's', 'i', 'c']);

/** A group of `PackedState` while `packState` collects it. */
/** How many of the last groups `packState` compares a record with, before it looks up its name. */
const RECENT_GROUPS = 4;

interface PackGroup {
  k: number;
  base: ScopeId;
  flags: number;
  count: number;
  m: string | undefined;
  /** The prefix of the IDs inside a `#loading` body, or `''`. */
  prefix: string;
  /** The scopes of the group, with their numbers after the prefix. */
  entries: ScopeEntry[];
}

/** The prefix of an ID and its number after it, such as `['', 3]` or `['5.', 1]`. */
function splitId(id: ScopeId): [prefix: string, n: number] {
  if (typeof id === 'number') {
    return ['', id];
  }
  const dot = id.lastIndexOf('.');
  return [id.slice(0, dot + 1), Number(id.slice(dot + 1))];
}

/** The records of the scopes of a render, by scope ID. */
export type StateMap = Map<ScopeId, ScopeState>;

/** The records of a state as a map, for a state written as an object, such as in tests. */
function toStateMap(state: PageState | StateMap): StateMap {
  if (state instanceof Map) {
    return state;
  }
  return new Map(Object.entries(state).map(([key, record]) => [parseId(key), record]));
}

/**
 * Visits the scopes of a state in the order of the keys of an object: number
 * IDs ascending, then string IDs in the order they were made. A render makes
 * its number IDs in order, so the scopes are only copied to sort them when
 * they are not.
 */
function visitOrdered(entries: readonly ScopeEntry[], visit: (entry: ScopeEntry) => void): void {
  let numbers: readonly ScopeEntry[] = entries;
  let last = -Infinity;
  for (const entry of entries) {
    if (typeof entry.id === 'number') {
      if (entry.id < last) {
        numbers = entries
          .filter((item) => typeof item.id === 'number')
          .toSorted((a, b) => (a.id as number) - (b.id as number));
        break;
      }
      last = entry.id;
    }
  }
  for (const entry of numbers) {
    if (typeof entry.id === 'number') {
      visit(entry);
    }
  }
  for (const entry of entries) {
    if (typeof entry.id !== 'number') {
      visit(entry);
    }
  }
}

/**
 * The list that the client can take the items of a group from: the items
 * are list items with the same source, the source's record is in `state`,
 * and the item of the scope at each position of the group is the value at
 * that position of the list. The client reads the same list, so it gets the
 * same values. Otherwise the items are written.
 */
function groupSource(
  record: (id: ScopeId) => ScopeState | undefined,
  group: PackGroup,
): ItemSource | undefined {
  const { entries } = group;
  const source = entries[0]!.source;
  if (!source || !(group.flags & (ITEM | ITEM_SLOT))) {
    return undefined;
  }
  const value = record(source[0])?.s?.[source[1]];
  // Seroval keeps the order of a Set. A Map's entries are new arrays, which the check below rejects.
  const list = value instanceof Set ? Array.from(value) : value;
  if (!Array.isArray(list) || list.length < entries.length) {
    return undefined;
  }
  for (let n = 0; n < entries.length; n++) {
    const entry = entries[n]!;
    if (entry.source !== source || !Object.is(list[n], entry.record.i)) {
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
export function packState(
  input: PageState | StateMap,
  sources?: Map<ScopeId, ItemSource>,
): PackedState {
  const state = toStateMap(input);
  const entries = Array.from(state, ([id, record]): ScopeEntry => {
    const [prefix, n] = splitId(id);
    return { id, prefix, n, record, ctx: undefined, source: sources?.get(id) };
  });
  return packEntries(entries, (id) => state.get(id));
}

/** Packs the scopes of a render. `lookup` finds the record of a scope in the same state. */
function packEntries(
  scopes: readonly ScopeEntry[],
  lookup: (id: ScopeId) => ScopeState | undefined,
): PackedState {
  const result: PackedState = {};
  const groups = new Map<string, PackGroup>();
  const recent: PackGroup[] = [];
  // Number IDs come in ascending order, and the IDs inside blocks in the order the render made
  // them, as an object orders its keys, so the gaps are positive and the output stays the same.
  visitOrdered(scopes, (entry) => {
    const { id, record, prefix, n } = entry;
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
      return;
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
    // The scopes of a list come in runs, so the last groups usually hold the record's group,
    // and the name of the group, a new string to hash, is made only when they do not.
    let group = recent.find(
      (item) =>
        item.k === record.k &&
        item.base === base &&
        item.flags === flags &&
        item.count === slots.length &&
        item.m === record.m &&
        item.prefix === prefix,
    );
    if (!group) {
      const name = `${prefix}:${record.k}:${base}:${flags}:${slots.length}:${record.m ?? ''}`;
      group = groups.get(name);
      if (!group) {
        group = {
          k: record.k,
          base,
          flags,
          count: slots.length,
          m: record.m,
          prefix,
          entries: [],
        };
        groups.set(name, group);
      }
      recent.unshift(group);
      if (recent.length > RECENT_GROUPS) {
        recent.pop();
      }
    }
    group.entries.push(entry);
  });
  const packed: unknown[][] = [];
  for (const group of groups.values()) {
    const { entries } = group;
    // A group of one scope is no shorter than its record.
    if (entries.length === 1) {
      result[entries[0]!.id] = entries[0]!.record;
      continue;
    }
    const source = groupSource(lookup, group);
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
    for (const { n: number, record: scope } of entries) {
      values.push(number - last);
      const slots = scope.s ?? [];
      for (let n = from; n < slots.length; n++) {
        values.push(slots[n]);
      }
      if (item) {
        values.push(scope.i);
      }
      if (flags & CHILDREN) {
        values.push(scope.c);
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
  state: PageState | StateMap | Context,
  refs: Map<unknown, number>,
  onRecord: (code: string, initial: boolean) => void,
  onError: (error: unknown) => void,
  onDone: () => void,
  sources?: Map<ScopeId, ItemSource>,
  last = false,
): void {
  const packed =
    state instanceof Context
      ? packEntries(state.scopes, (id) => state.ownRecord(id))
      : packState(state, sources);
  // A record that holds the value of a server variable is not sent, nor any after it.
  let leaked = false;
  const send = (code: string, initial: boolean): void => {
    const error = leaked ? undefined : secretError(code);
    if (error) {
      leaked = true;
      onError(error);
    } else if (!leaked) {
      onRecord(code, initial);
    }
  };
  if (last) {
    let code: string | undefined;
    try {
      code = crossSerialize(packed, {
        plugins: syncPlugins,
        ...serialOptions(),
        refs,
        assignSharedRefsOnly: true,
      });
    } catch {
      // The stream gives the same error for a value that cannot be sent, with the same references.
      refs.clear();
    }
    if (code !== undefined) {
      send(code, true);
      onDone();
      return;
    }
  }
  crossSerializeStream(packed, {
    plugins,
    ...serialOptions(),
    refs,
    onSerialize: send,
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
  state: PageState | StateMap,
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
  /** The params of the route of the page, on its first record, for `$route` in the browser. */
  params?: Record<string, string>;
  /** The ID of the build that rendered the page, on its first record, for skew protection. */
  build?: string;
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
  if (attributes.params !== undefined) {
    extra += ` b-params="${escapeAttribute(JSON.stringify(attributes.params))}"`;
  }
  if (attributes.build !== undefined) {
    extra += ` b-build="${escapeAttribute(attributes.build)}"`;
  }
  return `<script${extra}>${attributes.define ? RECORD : ''}$bR(($R,$b)=>(${code}))</script>`;
}

// Moves the head markup of a `#loading` body into the head, and sets the title.
// A `<title>` of `#head` keeps its text: the head gets a title of its own for `document.title`.
const HEAD = `function $bH(i,t){var e=document.querySelector('template[b-h="'+i+'"]'),h=document.head;e&&(h.append(e.content),e.remove());t!=null&&(h.querySelector('title:not([b-t])')||h.prepend(document.createElement('title')),document.title=t)}`;

// Shows a fallback that `#reveal (collapsed)` held in a <template>, when the body before it shows.
const SHOW_FALLBACK = `function $bF(i){var t=document.querySelector('template[b-f="'+i+'"]');t&&t.replaceWith(t.content)}`;

// Moves a `#loading` body from its <template> into the page, in place of the fallback.
const SWAP = `function $bS(i){var t=document.querySelector('template[b-l="'+i+'"]'),w=document.createTreeWalker(document.body,128),s,n,d=0;while(n=w.nextNode())if(n.data==='l'+i){s=n;break}if(!s||!t)return;var p=s.parentNode;for(n=s.nextSibling;n;){if(n.nodeType===8){if(n.data==='/l'){if(!d)break;d--}else if(/^l\\d/.test(n.data))d++}var x=n.nextSibling;p.removeChild(n);n=x}p.insertBefore(t.content,s);p.removeChild(s);n&&p.removeChild(n);t.remove()}`;

// In development, the swap keeps the fallback that it removes and the body that it adds, by
// boundary, so the devtools can show the fallback again.
const SWAP_DEV = `function $bS(i){var t=document.querySelector('template[b-l="'+i+'"]'),w=document.createTreeWalker(document.body,128),s,n,d=0;while(n=w.nextNode())if(n.data==='l'+i){s=n;break}if(!s||!t)return;var p=s.parentNode,f=[];for(n=s.nextSibling;n;){if(n.nodeType===8){if(n.data==='/l'){if(!d)break;d--}else if(/^l\\d/.test(n.data))d++}var x=n.nextSibling;f.push(p.removeChild(n));n=x}(self.$bD||(self.$bD={}))[i]={f:f,b:[].slice.call(t.content.childNodes)};p.insertBefore(t.content,s);p.removeChild(s);n&&p.removeChild(n);t.remove()}`;

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
   * The event of the request. Its `signal` aborts when the reader of the
   * response goes away, which `streamParts` and `renderToStream` report.
   */
  event?: RequestEvent;
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
  /** In development: the swaps of `#loading` bodies keep their fallbacks, for the devtools. */
  dev?: boolean;
  /**
   * The first scope and boundary ID. A page that the client loads in place
   * of another starts above the IDs of the page it keeps parts of.
   */
  base?: number;
  /** Names the route of the page, so the client knows which layouts it can keep. */
  route?: string;
  /**
   * Renders `#loading` and `#defer` bodies in place, in the order of the
   * page, instead of streaming them in `<template>`s that a script swaps in.
   * The page arrives later, and complete, for readers that run no scripts,
   * such as crawlers. The state is the same either way. `'bots'`, the
   * default, does it for requests whose `User-Agent` is a known crawler. A
   * function decides for each request.
   */
  inOrder?: boolean | 'bots' | ((request: Request) => boolean);
  /** The params of the route of the page, for `$route`. `handleRoute` sets them. */
  params?: Record<string, string>;
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
   * Keeps work going after the response ends, for `event.waitUntil`, such
   * as the `waitUntil` of Cloudflare Workers. Without it, the promise runs
   * on its own and its error is logged.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
  /**
   * A Content Security Policy nonce for the inline scripts: the state
   * records, and the scripts that swap in `#loading` bodies.
   */
  nonce?: string;
  /**
   * The ID of the build, for skew protection. The page state carries it,
   * and the browser sends it with each call. The Vite plugin sets it in
   * builds. See `handleRequest`.
   */
  build?: string;
  /**
   * The address of the client as the server saw it, such as the remote
   * address of the socket, for `clientAddress` and rate limits.
   */
  address?: string;
  /** True while the build prerenders the page. Rate limits do not count then. */
  prerender?: boolean;
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
  if (options.params) {
    ctx.params = options.params;
  }
  ctx.build = options.build;
  if (options.defer) {
    ctx.target = { ...options.defer };
  }
  ctx.inOrder =
    !options.defer &&
    rendersInOrder(options.inOrder ?? 'bots', options.request ?? options.event?.request);
  const event =
    options.event ??
    (options.request
      ? new RequestEvent(options.request, {
          kind: options.defer ? 'defer' : 'page',
          waitUntil: options.waitUntil,
          address: options.address,
          prerender: options.prerender,
        })
      : undefined);
  ctx.event = event;
  // The first part of each component runs with the event, and so do memos, which the compiler gives `$$ctx`.
  const rendered = (await ctx.run(() => Root(props, ctx))) as string;
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
  // The function that swaps a body in, which the first swap of the page defines.
  const swapScript = options.dev ? SWAP_DEV : SWAP;
  // `$bF` is defined in the first script that shows a held fallback.
  let fallbackDefined = false;
  const showFallback = (): string => {
    if (fallbackDefined) {
      return '';
    }
    fallbackDefined = true;
    return `${SHOW_FALLBACK};`;
  };
  const serialize = (
    target: Context,
    onScopes: (script: string) => void,
    route?: string,
    onError: (error: unknown) => void = (error) => pending().fail(unsendable(error, target)),
    last = false,
  ): void => {
    open++;
    serializeState(
      target,
      refs,
      (code, initial) => {
        if (initial) {
          onScopes(
            stateScript(code, true, {
              next: ctx.next(),
              route,
              root,
              nonce,
              define: first,
              // The params go with the route, so the browser reads them after a navigation.
              params: route === undefined ? undefined : options.params,
              build: first ? options.build : undefined,
            }),
          );
          first = false;
        } else {
          pending().push(stateScript(code, false, { root, nonce }));
        }
      },
      onError,
      finish,
      undefined,
      last,
    );
  };

  // In order: the bodies render where they are, so the page waits for every one of them.
  const inOrder: Boundary[] | undefined = ctx.inOrder ? [] : undefined;
  // When the reader of the response leaves, the bodies that are not sent yet are not sent.
  const stopped = (): boolean => event?.signal.aborted === true;
  event?.signal.addEventListener('abort', () => queue?.close(), { once: true });
  ctx.watch((boundary) => {
    if (inOrder) {
      inOrder.push(boundary);
      return;
    }
    boundaries++;
    open++;
    // A body whose `#reveal` holds it waits for its turn. One that is not sent still takes its
    // turn, and can show the fallback after it.
    const skip = (after: string): void => {
      if (after) {
        pending().push(`${scriptTag}${showFallback()}${after}</script>`);
      }
      finish();
    };
    const turn = (send: (after: string) => void): void => {
      if (boundary.group) {
        boundary.group.ready(boundary.id, send);
      } else {
        send('');
      }
    };
    boundary.render.then(
      (result) => {
        // A `#try` body around it failed, so the page has no markers for it. A body around the
        // target of a `#defer` request is in the page already.
        if (boundary.cancelled || boundary.around || stopped()) {
          turn(skip);
          return;
        }
        turn((after) => {
          serialize(result.ctx, (script) => {
            // An ID inside a boundary, such as `5.1`, is a string.
            const id = scriptJSON(boundary.id);
            let call = `${swap ? '' : swapScript}$bS(${id})`;
            swap = true;
            if (after) {
              call += `;${showFallback()}${after}`;
            }
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
        });
      },
      (error: unknown) => {
        // The fallback stays in the page.
        console.error(error);
        turn(skip);
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
    boundaries === 0 && (inOrder === undefined || inOrder.length === 0),
  );
  if (failure !== undefined) {
    throw unsendable(failure, ctx);
  }
  let page = html;
  if (inOrder) {
    // Each body that renders can add more, so the list grows while it is read.
    const bodies = new Map<string, string>();
    const portals: string[] = [];
    for (let index = 0; index < inOrder.length; index++) {
      const boundary = inOrder[index]!;
      let result: { html: string; ctx: Context };
      try {
        // oxlint-disable-next-line no-await-in-loop -- The bodies settle in the order of the page.
        result = await boundary.render;
      } catch (error) {
        // The fallback stays in the page.
        console.error(error);
        continue;
      }
      if (boundary.cancelled || boundary.around) {
        continue;
      }
      bodies.set(String(boundary.id), result.html);
      portals.push(...result.ctx.portals);
      ctx.adoptHead(result.ctx.lateHead());
      // The records of the bodies follow the page state, so they run after it, as when they stream.
      serialize(
        result.ctx,
        (script) => {
          state += script;
        },
        undefined,
        (error) => {
          failure = error;
        },
        index === inOrder.length - 1,
      );
      if (failure !== undefined) {
        throw unsendable(failure, result.ctx);
      }
    }
    page = beforeBodyEnd(inlineBodies(rendered, bodies), [...ctx.portals, ...portals].join(''));
  }
  return {
    html: page,
    state,
    // Nothing is open when the page has no `#loading` body that is not ready and no promise in its state.
    pending: queue === undefined && open === 0 ? NOTHING_PENDING : pending().iterable,
    headers: event?.headers ?? new Headers(),
    status: event?.status ?? 200,
    next: () => ctx.next(),
    head: ctx.headHTML(),
    event,
  };
}

/** Crawlers and link previews, which read the page without running its scripts. */
const BOTS =
  /bot\b|bot\/|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|whatsapp|lighthouse|google-inspectiontool|headlesschrome/i;

/** True if a render with these options writes its bodies in place. */
function rendersInOrder(
  option: boolean | 'bots' | ((request: Request) => boolean),
  request: Request | undefined,
): boolean {
  if (typeof option === 'boolean') {
    return option;
  }
  if (!request) {
    return false;
  }
  if (typeof option === 'function') {
    return option(request);
  }
  return BOTS.test(request.headers.get('user-agent') ?? '');
}

// The markers of a `#loading` or `#defer` boundary, and the end of one.
const BOUNDARY_MARKER = /<!--(l[\d.]+|\/l)-->/g;

/**
 * Puts the bodies of boundaries in place of their fallbacks, with the bodies
 * inside them, as the swap script would in the browser. A `#defer` block
 * loses its `<template>` too, so the browser does not ask for a body that
 * is there. A boundary without a body keeps its fallback.
 */
export function inlineBodies(html: string, bodies: Map<string, string>): string {
  let result = '';
  let position = 0;
  BOUNDARY_MARKER.lastIndex = 0;
  for (let match = BOUNDARY_MARKER.exec(html); match; match = BOUNDARY_MARKER.exec(html)) {
    if (match[1] === '/l') {
      continue;
    }
    const id = match[1]!.slice(1);
    // The end of this boundary, past the boundaries inside its fallback.
    let depth = 0;
    let end = -1;
    for (let inner = BOUNDARY_MARKER.exec(html); inner; inner = BOUNDARY_MARKER.exec(html)) {
      if (inner[1] !== '/l') {
        depth++;
      } else if (depth === 0) {
        end = inner.index + inner[0].length;
        break;
      } else {
        depth--;
      }
    }
    if (end === -1) {
      break;
    }
    const body = bodies.get(id);
    if (body === undefined) {
      continue;
    }
    let before = html.slice(position, match.index);
    before = before.replace(
      new RegExp(
        `<template b-b="[^"]*" b-defer="[^":]*:${id.replace(/\./g, '\\.')}:[^"]*"></template>$`,
      ),
      '',
    );
    result += before + inlineBodies(body, bodies);
    position = end;
    BOUNDARY_MARKER.lastIndex = end;
  }
  return result + html.slice(position);
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
  let parts: RenderResult | undefined;
  let cancelled = false;
  return new ReadableStream<string>({
    async start(controller) {
      try {
        parts = await getParts();
        if (cancelled) {
          parts.event?.abort();
          return;
        }
        await writeParts(parts, options, controller, () => cancelled);
      } catch (error) {
        if (!cancelled) {
          controller.error(error);
        }
      }
    },
    // The reader went away, such as a browser that left the page while it streamed. The event's
    // signal aborts, so the work that nobody waits for stops.
    cancel(reason) {
      cancelled = true;
      parts?.event?.abort(reason);
    },
  });
}

async function writeParts(
  parts: RenderResult,
  options: DocumentOptions,
  controller: ReadableStreamDefaultController<string>,
  cancelled: () => boolean = () => false,
): Promise<void> {
  controller.enqueue(firstRender(parts.html, parts.head, parts.state, options));
  if (parts.pending !== NOTHING_PENDING) {
    for await (const chunk of parts.pending) {
      if (cancelled()) {
        return;
      }
      controller.enqueue(chunk);
    }
  }
  if (!cancelled()) {
    controller.close();
  }
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
 * A response with `init`. A DOM environment such as happy-dom drops
 * `set-cookie` from the headers that a response is made with, but keeps the
 * ones added after, so a page in `brumate/testing` keeps its cookies.
 */
function respond(body: BodyInit | null, init: ResponseInit & { headers: Headers }): Response {
  const result = new Response(body, init);
  if (result.headers.getSetCookie().length === 0) {
    for (const cookie of init.headers.getSetCookie()) {
      result.headers.append('set-cookie', cookie);
    }
  }
  return result;
}

/**
 * True when a request names a build other than the server's, so its page is
 * from before a deploy. Calls send the build in `x-brumate-build`, and forms
 * without scripts in `__build` of their URL.
 */
function isSkewed(request: Request, build: string | undefined): boolean {
  const sent =
    request.headers.get('x-brumate-build') ?? new URL(request.url).searchParams.get('__build');
  return build !== undefined && sent !== null && sent !== build;
}

/**
 * The answer to a form without scripts, from a page of another build, that
 * posts to a function that is gone. It goes back to its page, which loads
 * with the new build, or to `/` when the page is on another site.
 */
function backAnswer(request: Request): Response {
  let location = '/';
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const page = new URL(referer);
      if (page.origin === new URL(request.url).origin) {
        location = `${page.pathname}${page.search}`;
      }
    } catch {
      // A referer that is not a URL goes to `/`.
    }
  }
  return new Response(null, { status: 303, headers: { location } });
}

/** The answer to a request from a page of another build that the server cannot serve. */
function skewAnswer(build: string): Response {
  return new Response(JSON.stringify({ error: 'The site changed. Load the page again' }), {
    status: 409,
    headers: { 'content-type': 'application/json', 'x-brumate-build': build },
  });
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
  invoke: () => unknown,
  headers: Headers,
  base?: string,
): Promise<{ result: unknown } | { answer: Response }> {
  try {
    return { result: await invoke() };
  } catch (error) {
    return { answer: formFailure(error, headers, base) };
  }
}

/** The answer to a form post whose server function threw, or whose data could not be read. */
function formFailure(error: unknown, headers: Headers, base?: string): Response {
  if (error instanceof Redirect) {
    headers.set('location', base ? new URL(error.location, base).href : error.location);
    return respond(null, { status: error.status, headers });
  }
  const { message, status } = errorAnswer(error, 'The server function failed');
  headers.set('content-type', 'text/plain; charset=utf-8');
  return respond(message, { status, headers });
}

/**
 * Calls a server function with the data of a form that the browser sent, and
 * sends the browser back to the page with a redirect. The response has the
 * headers of the event, such as cookies that the function set.
 */
async function handleForm(invoke: () => unknown, event: RequestEvent): Promise<Response> {
  const { headers } = event;
  const outcome = await callWithForm(invoke, headers);
  if ('answer' in outcome) {
    return outcome.answer;
  }
  headers.set('location', event.request.headers.get('referer') ?? '/');
  return respond(null, { status: 303, headers });
}

/**
 * The arguments of a call. They come as seroval JSON, or as multipart form
 * data when they hold files: the JSON in `args`, and each file in
 * `file<index>`, whose index stands in the JSON.
 */
async function readArgs(request: Request): Promise<unknown[]> {
  if (!request.headers.has('x-brumate-args')) {
    return fromJSON<unknown[]>((await request.json()) as SerovalJSON, {
      plugins,
      ...serialOptions(),
    });
  }
  const form = await request.formData();
  return fromJSON<unknown[]>(JSON.parse(String(form.get('args'))) as SerovalJSON, {
    plugins: callPlugins(undefined, form),
    ...serialOptions(),
  });
}

export interface RequestOptions {
  /**
   * Other origins that may call server functions and post forms to them,
   * such as `https://app.example.com`. The origin of the request is always
   * allowed.
   */
  origins?: string[];
  /**
   * The middleware of the entry, which runs for every request before
   * anything else: pages, endpoints, calls, form posts and `#defer` bodies.
   * The Vite plugin passes the default export of `src/middleware.ts`.
   */
  middleware?: EntryMiddleware;
  /**
   * The middleware of each `'use server'` file, by the ID of each of its
   * functions. It runs before the function, after the middleware of the
   * entry. `virtual:brumate/server` passes them.
   */
  fileMiddleware?: Record<string, EntryMiddleware>;
  /** Keeps work going after the response ends, for `event.waitUntil`. See `RenderOptions`. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /**
   * The ID of the build, for skew protection. A call from a page of another
   * build to a function that is gone answers 409 with this ID in
   * `x-brumate-build`, and the browser loads the page again. A call to a
   * function that still exists runs. The Vite plugin sets it in builds.
   */
  build?: string;
  /** The address of the client as the server saw it, for `clientAddress` and rate limits. */
  address?: string;
  /** True while the build prerenders the pages. Rate limits do not count then. */
  prerender?: boolean;
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
  // The browser asks for the build of the server when the code of its page fails to load.
  if (id === '') {
    const headers: Record<string, string> =
      options.build === undefined ? {} : { 'x-brumate-build': options.build };
    return new Response(null, { status: 204, headers });
  }
  // A call with files sends its arguments as form data, with this header.
  const form = isFormPost(request) && !request.headers.has('x-brumate-args');
  // A form without scripts posts to the function, and wants a page back, not the result. The
  // loader sends a form of an `$action` with this header, and wants the result.
  const posted = form && !request.headers.has('x-brumate-result');
  const fn = functions[id];
  if (!fn) {
    if (!isSkewed(request, options.build)) {
      return unknownAnswer(id);
    }
    return posted ? backAnswer(request) : skewAnswer(options.build!);
  }
  const event = new RequestEvent(request, {
    kind: 'call',
    waitUntil: options.waitUntil,
    address: options.address,
    prerender: options.prerender,
  });
  // The arguments are read before the middleware runs, so a check can depend on them. Arguments
  // that fail to read, such as a regular expression, answer as an error of the call.
  let args: unknown[];
  try {
    args = form ? [await request.formData()] : await readArgs(request);
  } catch (error) {
    return posted ? formFailure(error, event.headers) : callFailure(error, event.headers);
  }
  event.call = { id, args };
  // The function runs with its event, so `getEvent()` before its first await returns it.
  const invoke = (): unknown => withEvent(event, () => fn(...args));
  return runEntry(options.middleware, event, () =>
    runEntry(options.fileMiddleware?.[id], event, () =>
      posted ? handleForm(invoke, event) : answerCall(functions, event, async () => invoke()),
    ),
  );
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
    return respond(
      toChunkStream(result, (reason) => event.abort(reason)),
      { headers },
    );
  } catch (error) {
    return callFailure(error, headers);
  }
}

/** The answer to a call whose server function threw, or whose arguments could not be read. */
function callFailure(error: unknown, headers: Headers): Response {
  if (error instanceof Redirect) {
    headers.set('x-brumate-redirect', error.location);
    return respond(null, { status: 204, headers });
  }
  const { message, status } = errorAnswer(error, 'The server function failed');
  headers.set('content-type', 'application/json');
  return respond(JSON.stringify({ error: message }), { status, headers });
}

interface ResolvedView {
  key: string;
  component: Component;
  slots: Record<string, ResolvedView>;
  /** `_loading.brm`: the view streams in, and this shows until then. */
  loading?: Component;
  /** The `cache` export of the module script of the file. */
  cache?: PageCache;
}

/**
 * How long a page can be cached for everyone, as a route exports it from
 * its module script: `export const cache = { maxAge: 60 }`. A layout's
 * applies to the pages below it, and the nearest one wins.
 */
export interface PageCache {
  /** Seconds that a cache can serve the page without asking again. */
  maxAge: number;
  /** Seconds after `maxAge` that a cache can serve the old page while it gets a new one. */
  staleWhileRevalidate?: number;
}

/** A page that the server keeps, as the store holds it. */
interface KeptPage {
  status: number;
  headers: [string, string][];
  body: string;
  /** When the page expires, in milliseconds since 1970. */
  expires: number;
  /** The versions of the tags of the `cached` functions that the page called. */
  tags: Record<string, string>;
}

/** The key of a page in the store: its URL, and the base of a client navigation, by build. */
function pageKey(url: URL, request: Request, build: string | undefined): string {
  const base = request.headers.get('x-brumate-base') ?? '';
  return `brumate:page:${build ?? ''}:${base}:${url.pathname}${url.search}`;
}

/** The page that the store keeps for a key, when it is still fresh. */
async function keptPage(key: string): Promise<Response | undefined> {
  const text = await cacheStore().get(key);
  if (!text) {
    return undefined;
  }
  const page = JSON.parse(text) as KeptPage;
  const tags = Object.keys(page.tags);
  const versions = await tagVersions(tags);
  if (page.expires <= Date.now() || tags.some((tag) => versions[tag] !== page.tags[tag])) {
    return undefined;
  }
  const headers = new Headers(page.headers);
  const maxAge = Number(/max-age=(\d+)/.exec(headers.get('cache-control') ?? '')?.[1] ?? 0);
  headers.set('age', String(Math.max(0, Math.floor(maxAge - (page.expires - Date.now()) / 1000))));
  headers.set('x-brumate-cache', 'hit');
  return new Response(page.body, { status: page.status, headers });
}

/** Keeps a public page in the store until its `max-age` ends. */
async function keepPage(key: string, response: Response, event: RequestEvent): Promise<void> {
  const maxAge = Number(
    /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ?? 0,
  );
  if (maxAge <= 0) {
    return;
  }
  const missing = [...event.cacheTags].filter(([, version]) => version === undefined);
  const versions = await tagVersions(missing.map(([tag]) => tag));
  const page: KeptPage = {
    status: response.status,
    headers: [...response.headers].filter(([name]) => name !== 'set-cookie'),
    body: await response.clone().text(),
    expires: Date.now() + maxAge * 1000,
    tags: Object.fromEntries(
      [...event.cacheTags].map(([tag, version]) => [tag, version ?? versions[tag]!]),
    ),
  };
  await cacheStore().set(key, JSON.stringify(page), maxAge);
}

/** The `cache` of the page of a view: the nearest one along its `children`. */
function pageCache(view: ResolvedView): PageCache | undefined {
  const inner = view.slots.children;
  return (inner && pageCache(inner)) ?? view.cache;
}

/**
 * The `cache-control` of a page with `cache`. It is public only when the
 * request did not read or set anything of the user, and the page is a
 * success without cookies.
 */
function cacheControl(
  cache: PageCache,
  event: RequestEvent | undefined,
  response: Response,
): string {
  if (event?.personal || response.status !== 200 || response.headers.getSetCookie().length > 0) {
    return 'private, no-cache';
  }
  const parts = ['public', `max-age=${Math.max(0, Math.floor(cache.maxAge))}`];
  if (cache.staleWhileRevalidate !== undefined) {
    parts.push(`stale-while-revalidate=${Math.max(0, Math.floor(cache.staleWhileRevalidate))}`);
  }
  return parts.join(', ');
}

// Pages that `cache` made private in development, so each warns once.
const warnedPrivate = new Set<string>();

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
    cache: (module as { cache?: PageCache }).cache,
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
/** The component IDs of a view and of the views in its slots. */
function viewIds(view: ResolvedView): string[] {
  const id = (view.component as { brumateId?: string }).brumateId;
  return [
    ...(id === undefined ? [] : [id]),
    ...Object.values(view.slots).flatMap((slot) => viewIds(slot)),
  ];
}

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
   * The HTML that the build prerendered for the path, for a server that has
   * the file. The server sends it at once, then renders the `#defer` blocks
   * with the `load` or `idle` trigger in the same response, in place of a
   * request for each. Requests for a `#defer` body and client navigation
   * render the route as usual.
   */
  shell?: string;
  /**
   * Keeps the pages that `cache` makes public in the store of `cached`, and
   * answers the next request for the same URL from it until `maxAge` ends or
   * `revalidate` drops a tag that the page used. Defaults to true. A CDN in
   * front of the server can keep them instead.
   */
  pageCache?: boolean;
  /**
   * Throws errors that are not a `ServerError` instead of rendering
   * `_error.brm`, so a dev server can show them, such as with `errorPage`
   * from `brumate/vite`. The Vite plugin sets it in development.
   */
  dev?: boolean;
  /** The server functions, by ID, for forms that post to a page. `virtual:brumate/routes` passes them. */
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  functions?: Record<string, (...args: any[]) => unknown>;
  /**
   * The URLs of the modules that every page loads early: the loader, and the
   * core that the first event loads. A page gets them as `Link` headers and
   * as `<link rel="modulepreload">` in its head. `virtual:brumate/routes`
   * passes them from the client build.
   */
  hints?: string[];
  /**
   * The URLs of the bundle of each root component, such as a route or a layout, by component ID:
   * its chunk and the chunks that it imports. A page adds those of its views to `hints`, so the
   * code of the page loads with the HTML. `virtual:brumate/routes` passes them.
   */
  bundleHints?: Record<string, string[]>;
  /**
   * Receives the `Link` values of `hints` before the page renders, so a
   * server can send them as `103 Early Hints`, such as with Node's
   * `response.writeEarlyHints({ link })`.
   */
  earlyHints?: (links: string[]) => void;
}

/**
 * Runs the server function that a form without scripts posted to a page, as
 * `?__action=<id>`. Returns its result for `$action`, or the response that
 * answers the post instead of the page: a redirect, or an error.
 * `handleRoute` adds the cookies of the event to that response, and no other
 * headers of the event.
 */
async function runAction(
  // oxlint-disable-next-line typescript/no-explicit-any -- Server functions take any arguments.
  fn: (...args: any[]) => unknown,
  event: RequestEvent,
): Promise<{ actions: Map<unknown, unknown> } | { answer: Response }> {
  const { request } = event;
  const args = event.call!.args;
  const outcome = await callWithForm(
    () => withEvent(event, () => fn(...args)),
    new Headers(),
    request.url,
  );
  return 'answer' in outcome ? outcome : { actions: new Map([[fn, outcome.result]]) };
}

/**
 * Reads the server function that a form without scripts posted to a page,
 * as `?__action=<id>`, into `event.call`, before any middleware runs.
 * Returns the response that answers the post instead of the page: a post
 * from another site, an unknown function, or a form that cannot be read.
 */
async function readAction(
  url: URL,
  event: RequestEvent,
  options: RouteOptions,
): Promise<Response | undefined> {
  const { request } = event;
  const id = url.searchParams.get('__action');
  if (request.method !== 'POST' || id === null) {
    return undefined;
  }
  if (isCrossSite(request, options)) {
    return crossSiteAnswer();
  }
  if (!options.functions?.[id]) {
    // A form from a page of another build goes back to its page, which loads with the new build.
    return isSkewed(request, options.build) ? backAnswer(request) : unknownAnswer(id);
  }
  try {
    event.call = { id, args: [await request.formData()] };
  } catch (error) {
    return formFailure(error, new Headers(), request.url);
  }
  return undefined;
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
  // In development, the render records what it does and when, for the Server tab of the devtools.
  const event = options.event;
  if (options.dev && event) {
    event.trace = [];
    event.traceStart = performance.now();
  }
  const path = new URL(request.url).pathname;
  const endRender = event?.traced('render', path) ?? (() => {});
  // Client navigation has the loader and the core already.
  const hints = request.headers.has('x-brumate-base')
    ? []
    : [
        ...new Set([
          ...(options.hints ?? []),
          ...viewIds(view).flatMap((id) => options.bundleHints?.[id] ?? []),
        ]),
      ];
  // A page with a nonce, under a strict policy, loads only what carries the nonce. A `Link`
  // header cannot, so the links are in the head only.
  const nonce = options.nonce === undefined ? '' : ` nonce="${escapeAttribute(options.nonce)}"`;
  const links = nonce ? [] : hints.map((url) => `<${url}>; rel=modulepreload`);
  if (links.length > 0) {
    options.earlyHints?.(links);
  }
  const preload = hints
    .map((url) => `<link rel="modulepreload"${nonce} href="${escapeAttribute(url)}">`)
    .join('');
  const parts = await render(
    viewComponent(view, props),
    {},
    {
      ...options,
      request,
      actions: extra.actions,
      route: view.key,
      params: props.params as Record<string, string> | undefined,
      base: Number.isSafeInteger(base) && base > 0 ? base : undefined,
    },
  );
  endRender();
  const endStream = event?.traced('stream', 'the rest of the page') ?? (() => {});
  const headers = new Headers(parts.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  // The same URL answers the request for a `#defer` body with that body only, and a navigation,
  // which sends `x-brumate-base`, without the links of the core.
  headers.append('vary', 'x-brumate-defer');
  headers.append('vary', 'x-brumate-base');
  for (const link of links) {
    headers.append('link', link);
  }
  let html = streamParts(parts, { ...options, head: preload + (options.head ?? '') });
  if (event?.trace) {
    // The trace goes last, once every body has streamed, as JSON that the devtools read.
    const trace = event.trace;
    html = html.pipeThrough(
      new TransformStream<string, string>({
        flush(controller) {
          endStream();
          const json = JSON.stringify({ route: path, entries: trace }).replace(/</g, '\\u003c');
          controller.enqueue(`<script type="application/json" b-trace>${json}</script>`);
        },
      }),
    );
  }
  const body = html.pipeThrough(new TextEncoderStream());
  const cache = request.method === 'GET' || request.method === 'HEAD' ? pageCache(view) : undefined;
  if (!cache) {
    return respond(body, { status: extra.status ?? parts.status, headers });
  }
  // A page with `cache` renders in full before its headers go out, so a `#loading` body that
  // reads the user makes it private too.
  const response = respond(await new Response(body).arrayBuffer(), {
    status: extra.status ?? parts.status,
    headers,
  });
  const control = cacheControl(cache, options.event, response);
  if (options.dev) {
    // A browser would keep the page while the files change, so the dev server only says what
    // the page would get.
    response.headers.set('cache-control', 'no-cache');
    response.headers.set('x-brumate-cache', control);
    if (control.startsWith('private') && !warnedPrivate.has(view.key)) {
      warnedPrivate.add(view.key);
      console.warn(
        `The page ${new URL(request.url).pathname} exports cache, but it read cookies or the authorization header, or set a cookie, so it is not cached for everyone. Move what reads the user into #defer.`,
      );
    }
  } else {
    response.headers.set('cache-control', control);
  }
  return response;
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
      params: props.params as Record<string, string> | undefined,
      base: Number.isSafeInteger(base) && base > 0 ? base : undefined,
      defer,
    },
  );
  const headers = new Headers(parts.headers);
  headers.append('vary', 'x-brumate-defer');
  if (parts.defer !== 'found') {
    return respond(null, { status: parts.defer === 'moved' ? 409 : 404, headers });
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
  return respond(body, { status: parts.status, headers });
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
  if (
    options.shell !== undefined &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    !deferTarget(request) &&
    !request.headers.has('x-brumate-base')
  ) {
    return fillHoles(tree, request, options.shell, options);
  }
  const url = new URL(request.url);
  const match = matchRoute(tree, url.pathname);
  // One event for the request: middleware, endpoints, a form's server function and the page
  // share it, so cookies that one sets reach the response and the others read them.
  const event =
    options.event ??
    new RequestEvent(request, {
      kind: await requestKind(request, match),
      waitUntil: options.waitUntil,
      address: options.address,
      prerender: options.prerender,
    });
  // Rate limits count by the pattern of the route, so `/api/1` and `/api/2` share a count.
  event.route = match?.route;
  const answer = await routeAnswer(tree, match, url, { ...options, event });
  return answer && withHeaders(answer, event.headers);
}

/**
 * What a request to a route is for: the body of a `#defer` block, an
 * endpoint when the folder has one that answers the method, or a page. A
 * path that no route matches is a page, the 404 page.
 */
async function requestKind(request: Request, match: RouteMatch | undefined): Promise<RequestKind> {
  if (deferTarget(request)) {
    return 'defer';
  }
  if (match?.endpoint) {
    const endpoint = await match.endpoint();
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    // A method that the endpoint does not answer gets 405 from it, unless the page answers GET.
    if (endpoint[method] || request.method !== 'GET') {
      return 'endpoint';
    }
  }
  return 'page';
}

/**
 * The `#defer` blocks of a prerendered page that the server renders in the
 * response: those with the `load` or `idle` trigger. A `visible` block is
 * far down the page, so it waits for the browser to ask for it.
 */
const HOLE = /<template b-b="([^"]+)" b-defer="(?:load|idle):([^:"]+):([^"]*)"/g;

/**
 * Answers with a prerendered page, then with the body of each of its
 * `#defer` blocks as it is ready, as a `#loading` body streams. Each body
 * renders in a request of its own, as when the browser asks for it, so
 * middleware runs for it. The loader leaves the marked blocks alone, and a
 * block whose body fails keeps its fallback.
 */
function fillHoles(
  tree: RouteNode,
  request: Request,
  shell: string,
  options: RouteOptions,
): Response {
  const holes = [...shell.matchAll(HOLE)];
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' });
  if (holes.length === 0) {
    return new Response(request.method === 'HEAD' ? null : shell, { headers });
  }
  // The bodies are for the user who asks, so the response is not cached for everyone.
  headers.set('cache-control', 'private, no-cache');
  headers.append('vary', 'x-brumate-defer');
  headers.append('vary', 'x-brumate-base');
  const marked = shell.replace(HOLE, (template) => `${template} b-hole`);
  const bodies = holes.map(async ([, at, boundary, base]) => {
    const asked = new Headers(request.headers);
    asked.set('x-brumate-defer', `${boundary} ${at}`);
    asked.set('x-brumate-base', base!);
    try {
      const answer = await handleRoute(tree, new Request(request.url, { headers: asked }), {
        ...options,
        shell: undefined,
        event: undefined,
      });
      return answer?.ok && answer.headers.get('x-brumate-defer') === boundary
        ? await answer.text()
        : '';
    } catch (error) {
      console.error(error);
      return '';
    }
  });
  const body = new ReadableStream<string>({
    async start(controller) {
      controller.enqueue(marked);
      // Each body as it is ready, so a slow one does not hold back the others.
      const pending = new Map(
        bodies.map((body, index) => [index, body.then((html) => ({ html, index }))]),
      );
      while (pending.size > 0) {
        // oxlint-disable-next-line no-await-in-loop -- The bodies stream in the order they are ready.
        const { html, index } = await Promise.race(pending.values());
        pending.delete(index);
        if (html) {
          controller.enqueue(html);
        }
      }
      controller.close();
    },
  }).pipeThrough(new TextEncoderStream());
  return new Response(request.method === 'HEAD' ? null : body, { headers });
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
  const result = respond(answer.body, answer);
  for (const cookie of cookies) {
    result.headers.append('set-cookie', cookie);
  }
  // A cookie is for one user, so a page with it is not cached for everyone.
  if (/^\s*public\b/.test(result.headers.get('cache-control') ?? '')) {
    result.headers.set('cache-control', 'private, no-cache');
  }
  return result;
}

async function routeAnswer(
  tree: RouteNode,
  match: RouteMatch | undefined,
  url: URL,
  options: RouteOptions,
): Promise<Response | undefined> {
  const event = options.event!;
  const { request } = event;
  // The body of a `#defer` block from a page of another build: its boundaries may differ.
  if (deferTarget(request) && isSkewed(request, options.build)) {
    return skewAnswer(options.build!);
  }
  if (!match) {
    const missing = notFound(tree);
    if (missing.errors.length === 0 && missing.middleware.length === 0 && !options.middleware) {
      return undefined;
    }
    return runEntry(options.middleware, event, () =>
      runMiddleware(missing.middleware, request, event, async () => {
        const page = await renderError(
          missing.errors,
          { message: 'Not found', status: 404 },
          {},
          request,
          options,
        );
        return page ?? new Response('Not found', { status: 404 });
      }),
    );
  }
  // A post from another site is refused before any middleware runs.
  const refused = await readAction(url, event, options);
  if (refused) {
    return refused;
  }
  return runEntry(options.middleware, event, () =>
    runMiddleware(match.middleware, request, event, () =>
      answerRoute(match, request, url, options),
    ),
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
  const event = options.event!;
  const call = event.call;
  // A form that posts to a page runs the middleware of its function's file, as a call does.
  return runEntry(call && options.fileMiddleware?.[call.id], event, () =>
    renderRoute(match, request, url, options),
  );
}

/** Runs the server function that a form posted to the page, if any, and renders the page. */
async function renderRoute(
  match: RouteMatch,
  request: Request,
  url: URL,
  options: RouteOptions,
): Promise<Response> {
  let actions: Map<unknown, unknown> | undefined;
  const event = options.event!;
  if (event.call) {
    const outcome = await runAction(options.functions![event.call.id]!, event);
    if ('answer' in outcome) {
      return outcome.answer;
    }
    actions = outcome.actions;
  }
  // A page that the server kept, for a request that has not read the user so far. Middleware
  // ran before, so a check of access still runs.
  const keep =
    !event.call &&
    !options.dev &&
    options.pageCache !== false &&
    event.kind === 'page' &&
    (request.method === 'GET' || request.method === 'HEAD');
  const key = keep ? pageKey(url, request, options.build) : undefined;
  if (key && !event.personal) {
    const kept = await keptPage(key);
    if (kept) {
      return kept;
    }
  }
  try {
    const view = await resolveView(match.view);
    const response = await renderPage(view, { params: match.params }, request, options, {
      actions,
    });
    if (key && /^\s*public\b/.test(response.headers.get('cache-control') ?? '')) {
      await keepPage(key, response, event);
    }
    return response;
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
export function spread(
  attributes: Record<string, unknown>,
  on?: string[],
  names?: boolean,
): string {
  // The `b-on` of a dynamic tag that names a component reaches the component as a prop, and
  // its handlers come first, as the element's own.
  const entries = on && ownValue('b-on', attributes['b-on']);
  if (typeof entries === 'string') {
    on!.unshift(entries);
    const { 'b-on': _, ...rest } = attributes;
    return spread(rest, on, names);
  }
  for (const [name, value] of Object.entries(attributes)) {
    // A merged handler writes one entry for each of its parts.
    const parts =
      on && /^on[A-Z]/.test(name) && typeof value === 'function'
        ? ((value as { [PARTS]?: object[] })[PARTS] ?? [value])
        : [];
    for (const part of parts) {
      const reference = functionReferences.get(part);
      if (reference) {
        const modifiers = (part as { [MODIFIERS]?: string[] })[MODIFIERS];
        on!.push(handlerEntry(name, reference.ref, reference.scope, modifiers, reference.args));
      }
    }
    // A binding that a rest prop passed on writes its slot, or calls its setter.
    if (on && (name === 'value' || name === 'checked') && isBinding(value)) {
      const setter =
        typeof value.set === 'function' ? functionReferences.get(value.set) : undefined;
      on.push(bindEntry(name, value.ref, setter));
    }
  }
  return spreadAttributes(attributes, names);
}

export { onAttribute };
