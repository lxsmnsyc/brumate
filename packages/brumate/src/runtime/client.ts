import { trustedHTML } from './trusted.ts';
import { loadOnce } from './skew.ts';
import {
  VOID_ELEMENTS,
  actionAttributes,
  attributeText,
  insertValue,
  rawHTML,
  spread as spreadText,
  textValue,
} from './html.ts';
import type { Raw } from './html.ts';
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
  stateValues,
} from './shared.ts';
import type { PackedState, PageState, ScopeId, ScopeState } from './shared.ts';
import { ROUTE_KEY } from './context.ts';
export { navigationContext, routeContext } from './context.ts';
import type { Context as ContextValue, Route } from './context.ts';

export { affix, attribute, classAttribute, escape, raw, spread, vars } from './html.ts';
export type { Raw } from './html.ts';
export { produce } from './produce.ts';
// For `client-routes.ts`, which reads the core with `import()`.
export { ElementReference, FunctionReference } from './shared.ts';
export { createContext } from './context.ts';

type Update = [kind: number, name: string];

/** The entry of a compiled client module. */
export interface ClientModule {
  id: string;
  /** Prop names to slot indices. `*` is the slot of a props object. */
  props: Record<string, number>;
  /** Scope kind, then slot, to the updates that read it. */
  g: Record<number, Record<number, Update[]>>;
  /**
   * Imports a part of the module. A module without it holds every part
   * itself, as a small component's module does.
   */
  load?: (part: string) => Promise<Part>;
  /** Server function ID to the memos that call it, as scope kind and update, for `refresh`. */
  refresh?: Record<string, Update[]>;
  /**
   * The `#try` blocks that catch errors of client code, by the scope kinds
   * inside their bodies: the kind of the scope that holds the block, the
   * anchor of the block, the render functions of the body and the `#catch`
   * body, and the kinds of both bodies.
   */
  t?: Record<
    number,
    [owner: number, anchor: number, body: string, fallback: string, kinds: number[]]
  >;
}

/** A part of a client module: one client root, or the updates. */
export type Part = Record<string, unknown>;

/** The part that holds an export: `h<n>` and `c<n>` have their own, the rest are in `update`. */
function partOf(name: string): string {
  return /^[hc]\d/.test(name) ? name : 'update';
}

/** The instance of a scope in the page. */
export interface Scope {
  id: ScopeId;
  /** The scope's ID in the compiled component. */
  k: number;
  p?: Scope;
  /** The component ID, for a component's root scope. */
  m?: string;
  s: unknown[];
  /** The item of a list item scope. */
  i?: unknown;
  c?: Record<number, ScopeId>;
  /** The scope that rendered a component's root scope. */
  o?: Scope;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  children: Set<Scope>;
  /** The `b-root` of the render that the server rendered the scope in. */
  r?: string;
  cleanups?: Map<string, () => void>;
  keys?: Map<number, unknown>;
  /** Set while the scope is the body of an `#offscreen` block that is hidden. */
  h?: HiddenBody;
  /** Effects and `$client` callbacks to run when the `#offscreen` body around the scope shows. */
  w?: Set<string>;
}

export interface CoreOptions {
  /**
   * Imports the client module of a component. Undefined for a component that
   * has no client code, which a build leaves out.
   */
  load: (id: string) => Promise<ClientModule> | undefined;
  /** Adds event listeners for the `b-on` attributes in new markup. */
  listen: (root: ParentNode) => void;
  /** The URL prefix of server function calls. Defaults to `/_brumate`. */
  rpc?: string;
  /** The ID of the build of the page, for skew protection. Calls send it, and a deploy is noticed. */
  build?: string;
  /**
   * Receives every error of client code first: of a handler, an effect, a
   * `$client` callback or a memo that loads. `scope` is the ID of the scope
   * that the code belongs to, when it has one.
   */
  onError?: (error: unknown, info: { scope?: ScopeId }) => void;
}

// The core keeps only what every page needs: it reads the state, runs handlers and updates.
// Each helper that compiled code calls is an export of its own, so a build leaves out the ones
// that no component calls. Features that change how the core reads the page, such as client
// navigation and hot updates, live in their own modules and set `hooks` when they load.

let options: CoreOptions;
/** The URL prefix of server function calls, from the options. */
export let rpcPrefix = '/_brumate';
/** The ID of the build of the page, from the loader. Undefined on the dev server. */
export let build: string | undefined;

/**
 * Tells the page that the site changed since it loaded: a call answered 409
 * with another build, or the code of a handler is gone. The loader then
 * loads the next page in full, and an app can save a draft first.
 */
export function skew(reason: 'call' | 'code' | 'defer'): void {
  document.dispatchEvent(new CustomEvent('brumate:skew', { detail: reason }));
}
/** The scopes of the page, by ID. */
export const scopes: Map<ScopeId, Scope> = new Map();

/** What modules of optional features add to the core. See `client-routes.ts` and `hot`. */
export const hooks: {
  /** Changes a state record before its scopes are added, such as for a page that navigation added. */
  record?: (script: Element, state: PageState) => PageState;
  /** Runs after the scopes of a state record are added. */
  added?: (added: Scope[]) => void;
} = {};

/** What the devtools overlay hears from the core. It is set only in development. */
export interface DevtoolsHooks {
  /** The core started, with the scopes of the page, and a way to write a slot, as a handler does. */
  attach?(core: {
    scopes: Map<ScopeId, Scope>;
    set: (scope: Scope, slot: number, value: unknown) => void;
  }): void;
  /** A handler starts for an event. */
  handler?(ref: string, element: Element, event?: Event): void;
  /** A part of a component's client code loaded. */
  part?(component: string, name: string): void;
  /** A slot got a new value. */
  write?(scope: Scope, slot: number, value: unknown): void;
}

/** The global key of the devtools hooks. */
export const DEVTOOLS: unique symbol = Symbol.for('brumate.devtools');

/**
 * True on the dev server, which has the devtools. A Vite build replaces it
 * with `false`, so the calls of the devtools hooks are left out. Without
 * Vite, `import.meta.env` is undefined, and the hooks are off.
 */
const DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

function devtools(): DevtoolsHooks | undefined {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS];
}
const modules = new Map<string, ClientModule>();
const loading = new Map<string, Promise<ClientModule>>();
const parts = new Map<string, Promise<Part>>();
const loadedParts = new Map<string, Part>();
const comments = new Map<string, Comment>();
const elements = new Map<string, Element>();
// Scopes that the client creates get negative IDs, so they never match IDs
// from state records that the server streams later.
let nextId = -1;

// Records of one render share references through an array, so a later record can settle a
// promise of an earlier one. Each render on the page has its own array, by its `b-root`.
const refs = new Map<string, unknown[]>();

/**
 * A state record: its script, and its code, which seroval wrote. The code
 * takes the references of its render and the functions that make brumate's
 * values, and returns the value of the record.
 */
type StateRecord = [
  script: HTMLScriptElement | null,
  code: (refs: unknown[], values: typeof stateValues) => unknown,
];

/**
 * The records that ran before the core started, or while it stopped. Each
 * state script hands its record to `push`, which the core replaces while it
 * runs, so it reads later records at once.
 */
function stateQueue(): StateRecord[] {
  const global = globalThis as { $brm?: StateRecord[] };
  return (global.$brm ??= []);
}

/** Reads the records that later state scripts hand over. Set while the core runs. */
function pushRecords(...added: StateRecord[]): number {
  for (const record of added) {
    readRecord(record);
  }
  return 0;
}

/**
 * Reads a state record. The first record holds the page state, and later
 * records settle the promises in it.
 */
function readRecord([script, code]: StateRecord): void {
  // A record of a page that navigation replaced before the core started.
  if (!script?.isConnected) {
    return;
  }
  const root = script.getAttribute('b-root') ?? '0';
  if (!refs.has(root)) {
    refs.set(root, []);
  }
  const decoded = code(refs.get(root)!, stateValues);
  // Records with scopes: the page state, and the state of each `#loading` body.
  if (script.hasAttribute('b-scopes')) {
    const unpacked = unpackState(decoded as PackedState);
    const added = addScopes(hooks.record ? hooks.record(script, unpacked) : unpacked, root);
    if (writes > 0) {
      refresh(added);
    }
  }
}

/**
 * Updates scopes that the server rendered before values changed on the
 * client, such as the body of a `#loading` block that streams in after an
 * event. Effects do not run: they run only when a value changes.
 */
function refresh(added: Scope[]): void {
  for (const scope of added) {
    const id = rootOf(scope).m;
    if (!id) {
      continue;
    }
    void loadModule(id).then(async (module) => {
      const names = new Set<string>();
      for (const slots of Object.values(module.g)) {
        for (const entries of Object.values(slots)) {
          for (const [kind, name] of entries) {
            if (kind === scope.k && name[0] !== 'e') {
              names.add(name);
            }
          }
        }
      }
      if (names.size === 0) {
        return;
      }
      const updates = await loadPart(module, 'update');
      // Memos first, so the other updates read their new values.
      for (const name of [...names].toSorted(
        (a, b) => Number(b[0] === 'm') - Number(a[0] === 'm'),
      )) {
        if (scopes.has(scope.id)) {
          (updates[name] as (scope: Scope) => void)(scope);
        }
      }
    });
  }
}

/** Reads the groups of scope records back into one record per scope. See `PackedState`. */
function unpackState(state: PackedState): PageState {
  // Items to take from the list in a slot of another record, once every record is read.
  const taken: [records: ScopeState[], source: ScopeId, slot: number, first: number][] = [];
  for (const group of state.g ?? []) {
    const [k, base, flags] = group as number[];
    const count = group[3] as number;
    let at = 4;
    const m = flags & MODULE ? (group[at++] as string) : undefined;
    const source: ScopeState[] | undefined = flags & SOURCE ? [] : undefined;
    if (source) {
      taken.push([source, group[at++] as ScopeId, group[at++] as number, flags & ITEM_SLOT]);
    }
    // Scopes inside a `#loading` body: their IDs are this prefix and a number.
    const prefix = flags & PREFIX ? (group[at++] as string) : '';
    const id = (n: number): ScopeId => (prefix ? prefix + n : n);
    // The first slot of a taken item is not written. The gap before the slots holds its place.
    const skip = source && flags & ITEM_SLOT ? 1 : 0;
    let n = flags & (OWNER | PREFIX) ? 0 : base;
    while (at < group.length) {
      n += group[at++] as number;
      const s = group.slice(at - skip, (at += count - skip));
      const record: ScopeState = flags & OWNER ? { k, o: id(n - base) } : { k, p: base };
      record.s = s;
      if (m !== undefined) {
        record.m = m;
      }
      if (source) {
        source.push(record);
      } else if (flags & ITEM_SLOT) {
        record.i = s[0];
      } else if (flags & ITEM) {
        record.i = group[at++];
      }
      if (flags & CHILDREN) {
        record.c = group[at++] as Record<number, ScopeId>;
      }
      state[id(n)] = record;
    }
  }
  delete state.g;
  for (const [records, source, slot, first] of taken) {
    // An array, or a Set, whose order the state keeps.
    const values = Array.from(state[source]!.s![slot] as Iterable<unknown>);
    for (let n = 0; n < records.length; n++) {
      const record = records[n]!;
      record.i = values[n];
      if (first) {
        record.s![0] = values[n];
      }
    }
  }
  return state;
}

function addScopes(state: PageState, root: string): Scope[] {
  const added: Scope[] = [];
  for (const [key, record] of Object.entries(state)) {
    const id = parseId(key);
    const scope: Scope = {
      id,
      k: record.k ?? 0,
      m: record.m,
      s: record.s ?? [],
      i: record.i,
      c: record.c,
      v: record.v,
      x: record.x,
      children: new Set(),
      r: root,
    };
    scopes.set(id, scope);
    added.push(scope);
  }
  for (const scope of added) {
    const record = state[scope.id]!;
    if (record.p !== undefined) {
      scope.p = scopes.get(record.p);
      scope.p?.children.add(scope);
      treeChanges++;
    }
    if (record.o !== undefined) {
      scope.o = scopes.get(record.o);
    }
  }
  const seen = new Set<object>();
  for (const scope of added) {
    // A provided value can hold functions, which a component that reads the context calls.
    for (const key of Object.keys(scope.v ?? {})) {
      scope.v![key] = callable(scope.v![key], seen);
    }
    for (let i = 0; i < scope.s.length; i++) {
      const value = callable(scope.s[i], seen);
      scope.s[i] = value;
      // A value that a later state record settles replaces its promise.
      if (value instanceof Promise) {
        void value.then((result) => {
          settled.set(value, result);
          if (scope.s[i] === value) {
            set(scope, i, result);
          }
        });
      }
    }
  }
  hooks.added?.(added);
  return added;
}

/**
 * Indexes the markers of markup that others insert, such as streamed
 * `#loading` bodies and the pages that navigation adds, so `findComment` can
 * take its records at once.
 */
let markerObserver: MutationObserver | undefined;

/** Stops reading state records and markers that arrive later. Later records wait for `init`. */
export function dispose(): void {
  const queue = stateQueue();
  if (queue.push === pushRecords) {
    // The array's own `push` again, so records wait in it.
    delete (queue as { push?: unknown }).push;
  }
  markerObserver?.disconnect();
  markerObserver = undefined;
}

/**
 * Stops reading, before client navigation replaces only some routes. The
 * server renders the new routes with its current values, so only the writes
 * that come after count for the records that stream in later.
 */
export function leaveRoutes(): void {
  dispose();
  writes = 0;
}

/**
 * Removes the scopes of a render, by its `b-root`, with the scopes inside
 * them. Their cleanups run, and their memos no longer load. Its markup
 * stays. `brumate/testing` calls it when a mounted component unmounts.
 */
export function removeRoot(root: string): void {
  const inside = (scope: Scope): boolean => {
    for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
      if (current.r === root) {
        return true;
      }
    }
    return false;
  };
  // Deleting from a map while iterating it is safe.
  for (const scope of scopes.values()) {
    if (inside(scope)) {
      removeScope(scope);
    }
  }
  refs.delete(root);
  for (const cache of [comments, elements]) {
    for (const [key, node] of cache) {
      if (!node.isConnected) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Forgets the code of components that changed on the dev server, so the next
 * event or update loads the new code. Their state stays. `brumate/hot` calls it.
 */
export function forget(ids: string[]): void {
  for (const id of ids) {
    modules.delete(id);
    loading.delete(id);
    // Deleting the entry that a loop is at is safe for a Map.
    for (const key of parts.keys()) {
      if (key.startsWith(`${id}:`)) {
        parts.delete(key);
        loadedParts.delete(key);
      }
    }
  }
}

/** The values of the signals of components whose markup changed, for when the page renders again. */
const remounts = new Map<
  string,
  { after: Record<number, string[]>; values: Record<string, unknown>[] }
>();

/**
 * Keeps the values of the signals of each instance of a component, by
 * name, before the page renders again with its new markup. `brumate/hot` calls it.
 */
export function remount(
  detail: {
    id: string;
    before: Record<number, string[]>;
    after: Record<number, string[]>;
    signals: string[];
  }[],
): void {
  hooks.added = restoreRemounts;
  for (const { id, before, after, signals } of detail) {
    const names = new Set(signals);
    const instances = [...scopes.values()].filter((scope) => scope.m === id);
    remounts.set(id, {
      after,
      // The signals of the script of the component. Signals of blocks, such as of a `#for`
      // body, start again.
      values: instances.map((root) => {
        const values: Record<string, unknown> = {};
        (before[root.k] ?? []).forEach((name, slot) => {
          if (names.has(name)) {
            values[name] = root.s[slot];
          }
        });
        return values;
      }),
    });
  }
}

/** Writes back the values of signals that `onRemount` kept, into the instances of the new page. */
function restoreRemounts(added: Scope[]): void {
  for (const [id, { after, values }] of remounts) {
    const instances = added.filter((scope) => scope.m === id);
    if (instances.length === 0) {
      continue;
    }
    remounts.delete(id);
    instances.forEach((root, index) => {
      const saved = values[index];
      (after[root.k] ?? []).forEach((name, slot) => {
        if (saved && name in saved) {
          set(root, slot, saved[name]);
        }
      });
    });
  }
}

/**
 * Forgets the page, before another page replaces it. Cleanups run. Loaded
 * modules and parts stay, so the next page does not load them again. Only
 * client navigation calls it.
 */
export function leavePage(): void {
  dispose();
  for (const scope of scopes.values()) {
    for (const cleanup of scope.cleanups?.values() ?? []) {
      cleanup();
    }
  }
  scopes.clear();
  comments.clear();
  elements.clear();
  pendingEffects.clear();
  hiding = undefined;
  loads.clear();
  loadingSlots.clear();
  for (const memoController of memoControllers.values()) {
    memoController.abort();
  }
  memoControllers.clear();
  renderedLoads.clear();
  for (const { timer } of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
  // The next page reuses scope IDs, so a guess left here would match its memos.
  guesses?.map.clear();
  nextId = -1;
  refs.clear();
  writes = 0;
  // Calls of the old page that are still out no longer count for its guesses.
  calling = 0;
  callEpoch++;
  lastHandler = Promise.resolve();
}

/** Reads the page state. The loader calls it once, before the first handler. */
export function init(value: CoreOptions): void {
  options = value;
  rpcPrefix = value.rpc ?? '/_brumate';
  build = value.build;
  const queue = stateQueue();
  // Records that are still streaming settle their promises when their scripts run.
  queue.push = pushRecords;
  for (const record of queue.splice(0)) {
    readRecord(record);
  }
  markerObserver = new MutationObserver(indexAdded);
  markerObserver.observe(document, { childList: true, subtree: true });
  // The whole document, because `#head` content is in the head.
  indexMarkers(document.documentElement);
  watchTitles(document);
  if (DEV) {
    devtools()?.attach?.({ scopes, set });
  }
}

/** Replaces function references with functions that call them. */
function callable(value: unknown, seen: Set<object>): unknown {
  if (value instanceof FunctionReference) {
    return (...args: unknown[]) => call(value.ref, scopes.get(value.scope), args);
  }
  if (typeof value === 'object' && value !== null && !seen.has(value)) {
    seen.add(value);
    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value) || prototype === Object.prototype || prototype === null) {
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        record[key] = callable(record[key], seen);
      }
    }
  }
  return value;
}

export function loadModule(id: string): Promise<ClientModule> {
  let promise = loading.get(id);
  if (!promise) {
    // A component without client code has nothing to update.
    promise = Promise.resolve(options.load(id)).then((loaded) => {
      const module = loaded ?? { id, props: {}, g: {} };
      modules.set(id, module);
      return module;
    });
    loading.set(id, promise);
  }
  return promise;
}

export function loadPart(module: ClientModule, name: string): Promise<Part> {
  const key = `${module.id}:${name}`;
  let promise = parts.get(key);
  if (!promise) {
    promise = (module.load ? module.load(name) : Promise.resolve(module as unknown as Part)).then(
      (part) => {
        loadedParts.set(key, part);
        if (DEV) {
          devtools()?.part?.(module.id, name);
        }
        return part;
      },
    );
    parts.set(key, promise);
  }
  return promise;
}

type Handler = (scope: Scope | undefined, ...args: unknown[]) => unknown;

/** Waits forever once the page loads again, so no error shows before it goes. */
let reloading: Promise<never> | undefined;

async function resolve(ref: string): Promise<Handler> {
  const [id, name] = ref.split('#') as [string, string];
  try {
    const module = await loadModule(id);
    const part = await loadPart(module, partOf(name));
    return part[name] as Handler;
  } catch (error) {
    // After a deploy, the files of a build can be gone. The page loads again, with the new code,
    // once for each build. Any other error, such as a module that throws, goes to `#try`.
    const next = await serverBuild();
    if (!reloading && next !== undefined && loadOnce(next)) {
      skew('code');
      location.reload();
      reloading = new Promise(() => {});
    }
    if (reloading) {
      return reloading;
    }
    throw error;
  }
}

/**
 * Asks the server for its build, after the code of a handler failed to
 * load. Returns it when it is not the build of the page. Undefined without
 * a build, when the request fails, or when the builds are the same.
 */
async function serverBuild(): Promise<string | undefined> {
  if (build === undefined) {
    return undefined;
  }
  try {
    const response = await fetch(`${rpcPrefix}/`, {
      method: 'POST',
      headers: { 'x-brumate-build': build },
    });
    const current = response.headers.get('x-brumate-build');
    return current !== null && current !== build ? current : undefined;
  } catch {
    return undefined;
  }
}

async function call(ref: string, scope: Scope | undefined, args: unknown[]): Promise<unknown> {
  return (await resolve(ref))(scope, ...args);
}

// The handler of the previous event, once it has started.
let lastHandler: Promise<unknown> = Promise.resolve();

/**
 * Keeps `currentTarget` on an event. The handler runs after the event has
 * finished dispatching, when the browser has already cleared it.
 */
function withTarget(event: Event, element: Element): Event {
  return new Proxy(event, {
    get(target, key) {
      if (key === 'currentTarget') {
        return element;
      }
      const value: unknown = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/**
 * Runs the handler `ref` for an element. The scope comes from the element's
 * `b-b` anchor, or from the nearest element around it that has one, which
 * the compiler checks is in the same scope.
 */
export function handle(element: Element, ref: string, event?: Event): Promise<unknown> {
  const anchor = element.closest('[b-b]')?.getAttribute('b-b');
  const scope = anchor ? scopes.get(parseId(anchor.split(':')[0]!)) : undefined;
  // A `<window>` or `<document>` listener in a hidden `#offscreen` body does not run.
  if (scope && hiding?.hidden(scope) && element.hasAttribute('b-listen')) {
    return Promise.resolve();
  }
  const args = event ? [withTarget(event, element)] : [];
  if (DEV) {
    devtools()?.handler?.(ref, element, event);
  }
  // Parts load in parallel, but handlers start in the order of their events,
  // so an input handler runs before the submit handler of a later event.
  const loaded = resolve(ref);
  const started = lastHandler
    .then(() => loaded)
    .then((handler) => ({ value: handler(scope, ...args) }));
  lastHandler = started.catch(() => {});
  // An error of the handler, or of the promise that an async one returns, goes to the nearest
  // `#try` around its scope.
  return started
    .then((result) => result.value)
    .catch((error: unknown) => {
      fail(scope, error);
    });
}

/**
 * Reports an error of client code: a handler, an effect, a `$client`
 * callback or a memo that loads. It renders the `#catch` body of the nearest
 * `#try` around the scope of the code, through the parents and the owners of
 * scopes. Without one, the page gets a `brumate:error` event on `window`,
 * with the error and the scope, and the error is logged.
 */
export function fail(scope: Scope | undefined, error: unknown): void {
  options.onError?.(error, { scope: scope?.id });
  void (async () => {
    for (let current = scope; current; current = current.p ?? current.o) {
      const id = rootOf(current).m;
      if (!id) {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop -- Each scope can belong to another component.
      const module = await loadModule(id);
      const entry = module.t?.[current.k];
      if (!entry) {
        continue;
      }
      // The scope that holds the block, which the anchor of the block counts from.
      let owner = current.p;
      while (owner && owner.k !== entry[0]) {
        owner = owner.p;
      }
      if (owner) {
        // oxlint-disable-next-line no-await-in-loop -- The first `#try` found catches the error.
        await catchInto(owner, module, entry, error);
        return;
      }
    }
    window.dispatchEvent(new CustomEvent('brumate:error', { detail: { error, scope } }));
    console.error(error);
  })();
}

/** Renders the `#catch` body of a `#try` with an error, in place of what the block shows. */
async function catchInto(
  owner: Scope,
  module: ClientModule,
  [, anchor, , fallback, kinds]: NonNullable<ClientModule['t']>[number],
  error: unknown,
): Promise<void> {
  const updates = await loadPart(module, 'update');
  const start = findComment(`b${owner.id}:${anchor}`);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  disposeKinds(owner, kinds);
  clear(start, end);
  insertHTML(end, (updates[fallback] as (parent: Scope, error: unknown) => string)(owner, error));
}

/** Returns the instance of a scope by its ID. */
export function scopeOf(id: ScopeId): Scope | undefined {
  return scopes.get(id);
}

// Slots

// oxlint-disable-next-line typescript/no-explicit-any -- Slots hold any value.
export function get(scope: Scope, slot: number): any {
  const value = scope.s[slot];
  // A value that the server still streams. A memo that reads it waits for it.
  if (computing > 0 && value instanceof Promise) {
    throw new NotReady(value);
  }
  if (value instanceof ElementReference) {
    const element = findElement(value.scope, value.anchor);
    if (element) {
      scope.s[slot] = element;
    }
    return element ?? undefined;
  }
  return value;
}

// The number of writes since the page loaded, so scopes that stream in later know to update.
let writes = 0;

export function set<T>(scope: Scope, slot: number, value: T): T {
  if (!Object.is(scope.s[slot], value)) {
    writes++;
    scope.s[slot] = value;
    if (DEV) {
      devtools()?.write?.(scope, slot, value);
    }
    trigger(scope, slot);
  }
  return value;
}

/**
 * The names of a call of a module function, for its shared code. Each ref
 * is a slot of `scope`, `[scope, slot]` for a slot of another scope, or
 * `[value]` for a value that does not change, such as a literal argument.
 */
export function cells(scope: Scope, links: unknown[], names: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  names.forEach((name, index) => {
    const ref = links[index];
    let owner = scope;
    let slot: number;
    if (typeof ref === 'number') {
      slot = ref;
    } else if ((ref as unknown[]).length === 2) {
      [owner, slot] = ref as [Scope, number];
    } else {
      Object.defineProperty(result, name, { get: () => (ref as unknown[])[0], set: () => {} });
      return;
    }
    Object.defineProperty(result, name, {
      get: () => get(owner, slot),
      set: (value: unknown) => set(owner, slot, value),
    });
  });
  return result;
}

// The latest load of each async memo, by `<scope>:<slot>`, so older results are dropped.
const loads = new Map<string, number>();
// Numbers loads across all memos, so a load is never numbered like an older one still in flight.
let loadCount = 0;
const loadingSlots = new Set<string>();

/** Marks a memo as loading. Its readers update the first time, so `$isPending` becomes true. */
function startLoading(scope: Scope, slot: number, key: string): void {
  if (!loadingSlots.has(key)) {
    loadingSlots.add(key);
    trigger(scope, slot);
  }
}

/** The timers of debounced and throttled memos, by `scope:slot`, with when each last computed. */
const timers = new Map<string, { timer?: ReturnType<typeof setTimeout>; last: number }>();

/**
 * Computes a memo of `$debounced` after its value stops changing for `ms`,
 * or one of `$throttled` at most once every `ms`, with the last value after
 * the wait. The memo is pending while it waits.
 */
export function timed(
  scope: Scope,
  slot: number,
  ms: number,
  throttle: boolean,
  compute: () => unknown,
): void {
  const key = `${scope.id}:${slot}`;
  const state = timers.get(key) ?? { last: -Infinity };
  timers.set(key, state);
  const run = (): void => {
    state.timer = undefined;
    state.last = Date.now();
    // A scope that left the page computes no more.
    if (scopes.get(scope.id) === scope) {
      memo(scope, slot, compute);
    }
  };
  const since = Date.now() - state.last;
  if (throttle && state.timer === undefined && since >= ms) {
    run();
    return;
  }
  if (!throttle) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
  state.timer ??= setTimeout(run, throttle ? ms - since : ms);
  startLoading(scope, slot, key);
}

/** True for a promise, or any object with a `then` method. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

/**
 * Writes the result of an async memo when it arrives. Until then the slot
 * keeps its value, and `pending` is true. Only the latest load is written.
 */
export function asyncMemo(scope: Scope, slot: number, promise: Promise<unknown>): void {
  const key = `${scope.id}:${slot}`;
  const load = ++loadCount;
  loads.set(key, load);
  startLoading(scope, slot, key);
  const settle = (value?: unknown, failed = false): void => {
    if (loads.get(key) !== load) {
      return;
    }
    loadingSlots.delete(key);
    if (!failed && !Object.is(scope.s[slot], value)) {
      set(scope, slot, value);
    } else {
      trigger(scope, slot);
    }
  };
  const failed = (error: unknown): void => {
    // A newer load of the memo aborted this one. The memo keeps its value, and the error goes
    // to the nearest `#try` around the memo.
    if (loads.get(key) === load) {
      fail(scope, error);
      settle(undefined, true);
    }
  };
  promise.then((value) => {
    if (!isAsyncIterable(value)) {
      settle(value);
      return;
    }
    // A stream, such as a server function that yields: the memo takes each
    // value, and is pending until the first arrives. A newer load stops it.
    void (async () => {
      try {
        for await (const item of value) {
          if (loads.get(key) !== load) {
            break;
          }
          if (loadingSlots.has(key)) {
            settle(item);
          } else if (!Object.is(scope.s[slot], item)) {
            set(scope, slot, item);
          }
        }
      } catch (error) {
        failed(error);
      }
    })();
  }, failed);
}

/** Thrown when a memo reads a value that is still loading. */
class NotReady extends Error {
  readonly source: Promise<unknown>;

  constructor(source: Promise<unknown>) {
    super('The value is still loading');
    this.source = source;
  }
}

// More than 0 while a memo computes, so reading a value that is still loading stops it.
let computing = 0;

/** Aborts the server function calls of a memo's compute, by memo key. */
const memoControllers = new Map<string, AbortController>();
/** The key of the memo that computes, if any. */
let memoKey: string | undefined;

/** The signal for server function calls while a memo computes. It is made on the first call. */
function memoSignal(): AbortSignal | undefined {
  if (memoKey === undefined) {
    return undefined;
  }
  let controller = memoControllers.get(memoKey);
  if (!controller) {
    controller = new AbortController();
    memoControllers.set(memoKey, controller);
  }
  return controller.signal;
}

/**
 * Computes a memo. A promise loads, and the memo keeps its value until it
 * settles. A memo that reads a value that is still loading keeps its value
 * too, and is pending until that value arrives and the memo computes again.
 */
export function memo(scope: Scope, slot: number, compute: () => unknown): void {
  const key = `${scope.id}:${slot}`;
  // A guess stays while its source has not changed, such as when a value the server streamed arrives.
  if (guesses?.same(key)) {
    return;
  }
  const rendered = scope.s[slot];
  if (renderedLoads.delete(key) && isThenable(rendered)) {
    asyncMemo(scope, slot, Promise.resolve(rendered));
    return;
  }
  let value: unknown;
  // Server function calls of the last compute are aborted, because their answers are out of date.
  memoControllers.get(key)?.abort();
  memoControllers.delete(key);
  const outer = memoKey;
  memoKey = key;
  computing++;
  try {
    value = compute();
  } catch (error) {
    if (!(error instanceof NotReady)) {
      throw error;
    }
    startLoading(scope, slot, key);
    return;
  } finally {
    computing--;
    memoKey = outer;
  }
  if (isThenable(value) || isAsyncIterable(value)) {
    asyncMemo(scope, slot, Promise.resolve(value));
    return;
  }
  // The values it read have arrived, so it is no longer pending.
  const waited = loadingSlots.delete(key);
  loads.delete(key);
  // An optimistic value that computes again follows its source, and drops its guess.
  guesses?.map.delete(key);
  if (!Object.is(scope.s[slot], value)) {
    set(scope, slot, value);
  } else if (waited) {
    trigger(scope, slot);
  }
}

interface Guesses {
  /** Optimistic values that hold a guess, with the slot that each goes back to. */
  map: Map<string, { scope: Scope; slot: number; source?: [Scope, number]; base?: unknown }>;
  same: (key: string) => boolean;
  reset: () => void;
}

/**
 * The guesses of `$optimistic` values. The first `guess` sets it, so the
 * code that reads guesses is left out of a build that makes none.
 */
let guesses: Guesses | undefined;
/** The values of promises that the server streamed, so a guess knows its source did not change. */
const settled = new WeakMap<Promise<unknown>, unknown>();

/** True while the source of a guess holds the value it had when the guess was made. */
function sameSource(key: string): boolean {
  const entry = guesses!.map.get(key);
  if (!entry?.source) {
    return false;
  }
  const current = entry.source[0].s[entry.source[1]];
  return (
    Object.is(current, entry.base) ||
    (entry.base instanceof Promise && settled.get(entry.base) === current)
  );
}
/** Server calls that have not finished, from forms and from `rpc`. */
let calling = 0;
/** Counts the pages that client navigation left, so calls of an old page are not counted down. */
let callEpoch = 0;

/**
 * Writes a guess into an optimistic value. It goes back to its source when
 * the source changes, which computes it again, or when every server call of
 * the page finishes, such as after a post failed.
 */
export function guess<T>(
  scope: Scope,
  slot: number,
  ...rest: [value: T] | [sourceScope: Scope, sourceSlot: number, value: T]
): T {
  const value = rest.at(-1) as T;
  const source = rest.length === 3 ? ([rest[0], rest[1]] as [Scope, number]) : undefined;
  const base = source && source[0].s[source[1]];
  guesses ??= { map: new Map(), same: sameSource, reset: resetGuesses };
  guesses.map.set(`${scope.id}:${slot}`, { scope, slot, source, base });
  return set(scope, slot, value);
}

/** Counts a server call, and puts guesses back when the last one finishes. */
export function track<T>(request: Promise<T>): Promise<T> {
  calling++;
  const epoch = callEpoch;
  const done = (): void => {
    if (epoch !== callEpoch) {
      return;
    }
    calling--;
    // Waits a task, so memos that the answer refreshed start to load first.
    setTimeout(() => calling || guesses?.reset(), 0);
  };
  request.then(done, done);
  return request;
}

function resetGuesses(): void {
  for (const [key, { scope, slot, source }] of guesses!.map) {
    // A source that loads again, such as a refreshed list, resets the guess when it arrives.
    if (source && pending(source[0], source[1])) {
      continue;
    }
    guesses!.map.delete(key);
    if (source && scopes.has(scope.id) && !Object.is(scope.s[slot], source[0].s[source[1]])) {
      set(scope, slot, source[0].s[source[1]]);
    }
  }
}

/** True while a new value of a memo loads, or while the server still streams its value. */
export function pending(scope: Scope, slot: number): boolean {
  return loadingSlots.has(`${scope.id}:${slot}`) || scope.s[slot] instanceof Promise;
}

/** `x++`, `x--`, `++x` and `--x`. */
export function update(scope: Scope, slot: number, delta: number, prefix: boolean): number {
  const previous = get(scope, slot) as number;
  set(scope, slot, previous + delta);
  return prefix ? previous + delta : previous;
}

function rootOf(scope: Scope): Scope {
  let current = scope;
  while (current.p) {
    current = current.p;
  }
  return current;
}

function trigger(scope: Scope, slot: number): void {
  const id = rootOf(scope).m!;
  const module = modules.get(id);
  const updates = loadedParts.get(`${id}:update`);
  if (module && updates) {
    run(module, updates, scope, slot);
    return;
  }
  // The first write to a component loads its update code. Later writes wait in order.
  void loadModule(id).then(async (loaded) => {
    if (loaded.g[scope.k]?.[slot]) {
      run(loaded, await loadPart(loaded, 'update'), scope, slot);
    }
  });
}

// Effects wait until every other update of a write has run, and run once each.
const pendingEffects = new Map<string, () => void>();
let running = 0;
let flushing = false;
/** Counts changes to the scope tree, so `run` knows when the descendants it found are out of date. */
let treeChanges = 0;

function run(module: ClientModule, updates: Part, scope: Scope, slot: number): void {
  running++;
  // The descendants of each kind, found once while the tree does not change.
  let found: Map<number, Scope[]> | undefined;
  let foundAt = treeChanges;
  try {
    for (const [kind, name] of module.g[scope.k]?.[slot] ?? []) {
      const fn = updates[name] as (scope: Scope) => void;
      if (kind === scope.k) {
        runUpdate(fn, name, scope);
        continue;
      }
      if (foundAt !== treeChanges) {
        found = undefined;
        foundAt = treeChanges;
      }
      found ??= new Map();
      let targets = found.get(kind);
      if (!targets) {
        targets = descendants(scope, kind);
        found.set(kind, targets);
      }
      for (const target of targets) {
        runUpdate(fn, name, target);
      }
    }
  } finally {
    running--;
  }
  if (running === 0) {
    flushEffects();
  }
}

/** Runs an update on a scope. An effect waits until the other updates have run. */
function runUpdate(fn: (scope: Scope) => void, name: string, target: Scope): void {
  if (name[0] === 'e') {
    pendingEffects.set(`${target.id}:${name}`, () => {
      if (scopes.has(target.id)) {
        fn(target);
      }
    });
  } else {
    fn(target);
  }
}

/**
 * Runs the effects that writes scheduled, in the order they were first
 * scheduled. Writes in an effect schedule more effects, which run after.
 */
function flushEffects(): void {
  if (flushing) {
    return;
  }
  flushing = true;
  try {
    // A map iterator also visits entries that are added while it runs.
    for (const [key, runEffect] of pendingEffects) {
      pendingEffects.delete(key);
      runEffect();
    }
  } finally {
    flushing = false;
  }
}

export function descendants(scope: Scope, kind: number, result: Scope[] = []): Scope[] {
  for (const child of scope.children) {
    if (child.k === kind) {
      result.push(child);
    }
    descendants(child, kind, result);
  }
  return result;
}

function destroy(scope: Scope): void {
  for (const child of Array.from(scope.children)) {
    destroy(child);
  }
  // The content of a `#portal` is elsewhere in the page, so it is removed by its markers.
  const start = comments.get(`P${scope.id}`);
  if (start?.isConnected) {
    const end = rangeEnd(start);
    clear(start, end);
    start.remove();
    end.remove();
  }
  removeScope(scope);
}

/**
 * Removes a scope from the page: its cleanups run, and its memo state goes,
 * so a load that settles later is not written. Its markup stays.
 */
export function removeScope(scope: Scope): void {
  for (const cleanup of scope.cleanups?.values() ?? []) {
    cleanup();
  }
  for (let slot = 0; slot < scope.s.length; slot++) {
    const key = `${scope.id}:${slot}`;
    memoControllers.get(key)?.abort();
    memoControllers.delete(key);
    clearTimeout(timers.get(key)?.timer);
    timers.delete(key);
    loads.delete(key);
    loadingSlots.delete(key);
    guesses?.map.delete(key);
  }
  if (scope.h) {
    hiding?.bodies.delete(scope.h);
  }
  scopes.delete(scope.id);
  scope.p?.children.delete(scope);
  treeChanges++;
}

function disposeKinds(scope: Scope, kinds: number[]): void {
  for (const child of Array.from(scope.children)) {
    if (kinds.includes(child.k)) {
      destroy(child);
    }
  }
}

// DOM

const MARKER = /^[btilP]-?\d/;

function markerKey(data: string): string {
  return data[0] === 'b' ? data.split(':').slice(0, 2).join(':') : data;
}

function indexMarkers(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    if (MARKER.test(data)) {
      comments.set(markerKey(data), node as Comment);
    }
  }
}

/** Indexes the markers in the nodes that mutation records added. */
function indexAdded(records: MutationRecord[]): void {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === 1) {
        indexMarkers(node);
      } else if (node.nodeType === 8 && MARKER.test((node as Comment).data)) {
        comments.set(markerKey((node as Comment).data), node as Comment);
      }
    }
  }
}

/**
 * Finds a marker in the page. Returns undefined when the markup is not in
 * the page, such as `children` inside a block that is closed. Updates to it
 * do nothing, and it updates when the client inserts it again.
 */
function findComment(key: string): Comment | undefined {
  let comment = comments.get(key);
  if (!comment?.isConnected) {
    // The index has every marker in the page once it reads the records that
    // are waiting. Before the core starts, or between pages, it reads the page.
    if (markerObserver) {
      indexAdded(markerObserver.takeRecords());
    } else {
      indexMarkers(document.documentElement);
    }
    comment = comments.get(key);
  }
  return comment?.isConnected ? comment : undefined;
}

function findElement(scope: ScopeId, anchor: number): Element | null {
  const key = `${scope}:${anchor}`;
  let element = elements.get(key);
  if (!element?.isConnected) {
    element = document.querySelector(`[b-b="${key}"]`) ?? undefined;
    if (element) {
      elements.set(key, element);
    }
  }
  return element ?? null;
}

/** Returns the marker that ends the range that `start` opens. */
function rangeEnd(start: Comment): Comment {
  let depth = 0;
  for (let node = start.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 8) {
      const data = (node as Comment).data;
      if (data[0] === '/') {
        if (depth === 0) {
          return node as Comment;
        }
        depth--;
      } else if (MARKER.test(data)) {
        depth++;
      }
    }
  }
  throw new Error(`Missing end marker for <!--${start.data}-->`);
}

function clear(start: Node, end: Node): void {
  while (start.nextSibling && start.nextSibling !== end) {
    start.nextSibling.remove();
  }
}

/**
 * Inserts rendered HTML before a node, or at the end of a parent, and runs
 * the work that waits for it.
 */
function insertHTML(before: Node | { parent: ParentNode }, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = trustedHTML(html);
  const fragment = template.content;
  // Markers that others inserted first, so the new markers win over them.
  if (markerObserver) {
    indexAdded(markerObserver.takeRecords());
  }
  indexMarkers(fragment);
  options.listen(fragment);
  watchTitles(fragment);
  const server = serverScopes(fragment);
  // The nodes of the insert, when hidden `#offscreen` markup can contain them.
  const added = hiding?.bodies.size ? [...fragment.childNodes] : undefined;
  if ('parent' in before) {
    before.parent.append(fragment);
  } else {
    before.parentNode!.insertBefore(fragment, before);
  }
  if (added) {
    hiding!.added(added);
  }
  // The records of this insert, whose markers are indexed already.
  markerObserver?.takeRecords();
  for (const fn of afterInsert.splice(0)) {
    fn();
  }
  // HTML from the server, such as `children`, can be older than the values on the client.
  if (server.length > 0) {
    refresh(server);
  }
}

/**
 * Returns the scopes from the server that markup refers to. Markup that the
 * client renders has client scopes, so these come from HTML that the server
 * rendered, such as the `children` of a component.
 */
function serverScopes(root: ParentNode): Scope[] {
  const ids = new Set<ScopeId>();
  for (const element of root.querySelectorAll('[b-b]')) {
    ids.add(parseId(element.getAttribute('b-b')!.split(':')[0]!));
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const match = /^[tb]([\d.]+):/.exec((node as Comment).data);
    if (match) {
      ids.add(parseId(match[1]!));
    }
  }
  return [...ids].flatMap((id) => {
    const scope = scopes.get(id);
    return scope ? [scope] : [];
  });
}

/**
 * Renders a `#portal` body into its target, between markers with its scope
 * ID. `kinds` names the body, so a new target first removes it from the old one.
 */
export function portalTo(
  scope: Scope,
  target: unknown,
  render: Render,
  kinds: number[] = [],
): void {
  disposeKinds(scope, kinds);
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(element instanceof Element)) {
    return;
  }
  // The body's scope is the first scope that the render creates.
  const id = nextId;
  insertHTML({ parent: element }, `<!--P${id}-->${render(scope)}<!--/P-->`);
}

/** Writes an inserted value between `<!--t…-->` and `<!--/t-->`. */
export function text(scope: Scope, anchor: number, value: unknown): void {
  const start = findComment(`t${scope.id}:${anchor}`);
  if (start) {
    write(start.parentNode!, start.nextSibling, rangeEnd(start), value);
  }
}

/** Writes an inserted value that is the whole content of the element with the anchor. */
export function content(scope: Scope, anchor: number, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    write(element, element.firstChild, null, value);
  }
}

/**
 * Writes the text of an element whose content is text, such as a `<textarea>`
 * or a `<title>`. A `<textarea>` gets the value too, as `value` does on an
 * `<input>`, so a change replaces what the user typed.
 */
export function writeText(scope: Scope, anchor: number, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    const written = textValue(value);
    element.textContent = written;
    if (element instanceof HTMLTextAreaElement) {
      element.value = written;
    }
  }
}

/**
 * Replaces the nodes of `parent` from `first` up to `end`, or to its last
 * child, with a value. A text node that stays a text node keeps its node.
 */
function write(
  parent: Node & ParentNode,
  first: ChildNode | null,
  end: Node | null,
  value: unknown,
): void {
  if (
    (typeof value === 'string' || typeof value === 'number') &&
    first?.nodeType === 3 &&
    first.nextSibling === end
  ) {
    // Hidden text keeps its new value for when it shows.
    const saved = hiding?.nodes.get(first);
    if (saved) {
      saved.v = String(value);
    } else {
      (first as Text).data = String(value);
    }
    return;
  }
  while (first && first !== end) {
    const next = first.nextSibling;
    first.remove();
    first = next;
  }
  insertHTML(end ?? { parent }, insertValue(value));
}

function setAttribute(element: Element, name: string, value: unknown): void {
  if (name === 'value' || name === 'checked') {
    (element as unknown as Record<string, unknown>)[name] =
      name === 'checked' ? Boolean(value) : (value ?? '');
  }
  const written = attributeText(name, value);
  if (written === undefined) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, written);
  }
  if (name === 'style') {
    hiding?.styled(element);
  }
}

export function attr(scope: Scope, anchor: number, name: string, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    setAttribute(element, name, value);
  }
}

export function attrs(scope: Scope, anchor: number, values: Record<string, unknown>): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    for (const [name, value] of Object.entries(values)) {
      if (name !== 'children' && !/^on[A-Z]/.test(name)) {
        setAttribute(element, name, value);
      }
    }
  }
}

type Render = (parent: Scope, item?: unknown, index?: number) => string;

/** Shows the branch at `index` of `#if` or `#switch`, or nothing for -1. */
export function branch(
  scope: Scope,
  anchor: number,
  index: number,
  renders: (Render | undefined)[],
  kinds: number[],
): void {
  const start = findComment(`b${scope.id}:${anchor}`);
  if (!start) {
    return;
  }
  if (Number(start.data.split(':')[2]) === index) {
    return;
  }
  const end = rangeEnd(start);
  disposeKinds(scope, kinds);
  clear(start, end);
  start.data = `b${scope.id}:${anchor}:${index}`;
  const render = renders[index];
  if (render) {
    insertHTML(end, render(scope));
  }
}

/** Renders the body of `#key` again when its value changes. */
export function rekey(
  scope: Scope,
  anchor: number,
  value: unknown,
  render: Render,
  kinds: number[],
): void {
  scope.keys ??= new Map();
  if (scope.keys.has(anchor) && Object.is(scope.keys.get(anchor), value)) {
    return;
  }
  scope.keys.set(anchor, value);
  const start = findComment(`b${scope.id}:${anchor}`);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  disposeKinds(scope, kinds);
  clear(start, end);
  insertHTML(end, render(scope));
}

/**
 * Renders the body of a `#try` block again, for its `reset` function. If the
 * body throws, the fallback renders again with the error.
 */
export async function reset(
  scope: Scope,
  anchor: number,
  id: string,
  body: string,
  fallback: string,
  kinds: number[],
): Promise<void> {
  const updates = await loadPart(await loadModule(id), 'update');
  const start = findComment(`b${scope.id}:${anchor}`);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  disposeKinds(scope, kinds);
  clear(start, end);
  let html: string;
  try {
    html = (updates[body] as Render)(scope);
  } catch (error) {
    // Scopes that the body created before it threw.
    disposeKinds(scope, kinds);
    afterInsert.length = 0;
    html = (updates[fallback] as (parent: Scope, error: unknown) => string)(scope, error);
  }
  insertHTML(end, html);
}

/**
 * Renders the body of a `#client` block once, in place of its fallback.
 * `kinds` are the scope IDs inside the fallback, whose instances go.
 */
export function fill(scope: Scope, anchor: number, render: Render, kinds: number[] = []): void {
  const start = findComment(`b${scope.id}:${anchor}`);
  // A block that rendered its body has a third number.
  if (!start || start.data.split(':').length > 2) {
    return;
  }
  start.data += ':1';
  const end = rangeEnd(start);
  disposeKinds(scope, kinds);
  clear(start, end);
  insertHTML(end, render(scope));
}

/**
 * Shows or hides the body of an `#offscreen` block. A body that the page
 * does not have yet renders the first time it shows. `kind` is the body's
 * scope ID in the compiled component.
 */
export function offscreen(
  scope: Scope,
  anchor: number,
  value: unknown,
  render: Render,
  kind: number,
): void {
  const start = findComment(`b${scope.id}:${anchor}`);
  if (!start) {
    return;
  }
  const visible = Boolean(value);
  // 1 for a body that shows, 0 for one that is hidden, and -1 for one that has not rendered.
  const state = start.data.split(':')[2];
  if (visible ? state === '1' : state !== '1') {
    return;
  }
  start.data = `b${scope.id}:${anchor}:${visible ? 1 : 0}`;
  const end = rangeEnd(start);
  if (state === '-1') {
    insertHTML(end, render(scope));
    return;
  }
  let body: Scope | undefined;
  for (const child of scope.children) {
    if (child.k === kind) {
      body = child;
    }
  }
  if (body) {
    hiding ??= createHiding();
    if (visible) {
      hiding.show(body);
    } else {
      hiding.hide(body, start, end);
    }
  }
}

/** A hidden `#offscreen` body: its scope, and the ranges of its markup and of its portals. */
export interface HiddenBody {
  scope: Scope;
  ranges: [start: Comment, end: Comment][];
}

/**
 * What a hidden node had before it was hidden: `n` hidden bodies that hide
 * it, and the text of a text node, or the inline `display` of an element
 * with its priority and whether it had a `style` attribute.
 */
interface Saved {
  n: number;
  v: string;
  p?: string;
  a?: boolean;
}

interface Hiding {
  bodies: Set<HiddenBody>;
  nodes: WeakMap<Node, Saved>;
  hide: (body: Scope, start: Comment, end: Comment) => void;
  show: (body: Scope) => void;
  /** True for a scope in a hidden body. */
  hidden: (scope: Scope) => boolean;
  /** Keeps an effect for when its body shows, and returns true, if its scope is hidden. */
  paused: (scope: Scope, name: string) => boolean;
  /** Hides the nodes that an insert added to hidden markup. */
  added: (nodes: Node[]) => void;
  /** Keeps an element hidden after its `style` attribute changed. */
  styled: (element: Element) => void;
}

/**
 * The code of hidden `#offscreen` bodies. The first body that hides sets it
 * up, so the core of a page without one only checks that it is not there.
 * A body is hidden with an inline `display: none !important` on each element
 * at its top level, which no stylesheet overrides, and empty text for each
 * text node. The nodes stay in the page, so form fields, focus and media
 * keep their state.
 */
let hiding: Hiding | undefined;

/** True for a scope that is `ancestor` or inside it, also through the owner of a component. */
function within(scope: Scope, ancestor: Scope): boolean {
  for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

/** True for a scope in a hidden `#offscreen` body. */
function hidden(scope: Scope): boolean {
  for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
    if (current.h) {
      return true;
    }
  }
  return false;
}

/** The nodes between two markers. */
function between([start, end]: [Comment, Comment]): Node[] {
  const result: Node[] = [];
  for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) {
    result.push(node);
  }
  return result;
}

/** The inline style of an element, which an element that is not HTML or SVG may not have. */
function display(element: Element): CSSStyleDeclaration | undefined {
  return (element as HTMLElement).style;
}

function createHiding(): Hiding {
  const bodies = new Set<HiddenBody>();
  const nodes = new WeakMap<Node, Saved>();
  const hideNode = (node: Node): void => {
    const saved = nodes.get(node);
    if (saved) {
      saved.n++;
      return;
    }
    if (node.nodeType === 3) {
      nodes.set(node, { n: 1, v: (node as Text).data });
      (node as Text).data = '';
      return;
    }
    const style = node.nodeType === 1 ? display(node as Element) : undefined;
    if (style) {
      nodes.set(node, {
        n: 1,
        v: style.getPropertyValue('display'),
        p: style.getPropertyPriority('display'),
        a: (node as Element).hasAttribute('style'),
      });
      style.setProperty('display', 'none', 'important');
    }
  };
  const showNode = (node: Node): void => {
    const saved = nodes.get(node);
    if (!saved || --saved.n > 0) {
      return;
    }
    nodes.delete(node);
    if (node.nodeType === 3) {
      (node as Text).data = saved.v;
      return;
    }
    const element = node as Element;
    const style = display(element)!;
    if (saved.v) {
      style.setProperty('display', saved.v, saved.p);
    } else {
      style.removeProperty('display');
    }
    if (!saved.a && element.getAttribute('style') === '') {
      element.removeAttribute('style');
    }
  };
  return {
    bodies,
    nodes,
    hidden,
    hide(body, start, end) {
      const record: HiddenBody = { scope: body, ranges: [[start, end]] };
      body.h = record;
      bodies.add(record);
      const inside = [...scopes.values()].filter((scope) => within(scope, body));
      for (const scope of inside) {
        // The content of a `#portal` in the body, elsewhere in the page.
        const portal = comments.get(`P${scope.id}`);
        if (portal?.isConnected) {
          record.ranges.push([portal, rangeEnd(portal)]);
        }
      }
      for (const range of record.ranges) {
        between(range).forEach(hideNode);
      }
      // Effects and `$client` callbacks that ran stop, and run again when the body shows.
      for (const scope of inside) {
        for (const [name, cleanup] of scope.cleanups ?? []) {
          cleanup();
          (scope.w ??= new Set()).add(name);
        }
        scope.cleanups?.clear();
      }
    },
    show(body) {
      const record = body.h;
      if (!record) {
        return;
      }
      body.h = undefined;
      bodies.delete(record);
      for (const range of record.ranges) {
        if (range[0].isConnected) {
          between(range).forEach(showNode);
        }
      }
      for (const scope of scopes.values()) {
        if (scope.w && within(scope, body) && !hidden(scope)) {
          const ref = `${rootOf(scope).m}#`;
          for (const name of scope.w) {
            void call(ref + name, scope, []);
          }
          scope.w = undefined;
        }
      }
    },
    paused(scope, name) {
      if (bodies.size === 0 || !hidden(scope)) {
        return false;
      }
      (scope.w ??= new Set()).add(name);
      return true;
    },
    added(added) {
      for (const node of added) {
        for (const record of bodies) {
          for (const [start, end] of record.ranges) {
            if (
              node.parentNode === start.parentNode &&
              start.compareDocumentPosition(node) & 4 &&
              node.compareDocumentPosition(end) & 4
            ) {
              hideNode(node);
            }
          }
          // A `#portal` that renders in a hidden body, whose nodes follow its marker.
          const data = node.nodeType === 8 ? (node as Comment).data : '';
          const scope = /^P-?[\d.]+$/.test(data) ? scopes.get(parseId(data.slice(1))) : undefined;
          if (scope && within(scope, record.scope)) {
            record.ranges.push([node as Comment, rangeEnd(node as Comment)]);
          }
        }
      }
    },
    styled(element) {
      const saved = nodes.get(element);
      const style = display(element);
      if (saved && style) {
        saved.v = style.getPropertyValue('display');
        saved.p = style.getPropertyPriority('display');
        saved.a = element.hasAttribute('style');
        style.setProperty('display', 'none', 'important');
      }
    },
  };
}

interface Item {
  scope: Scope;
  nodes: Node[];
}

/** Updates the items of `#for` or `#repeat`, keeping the elements of items whose keys stay. */
export function list(
  scope: Scope,
  anchor: number,
  items: unknown[],
  key: (item: unknown, index: number) => unknown,
  render: Render,
  assign: (scope: Scope, item: unknown, index: number) => void,
  fallback: Render | undefined,
  fallbackKinds: number[],
): void {
  const start = findComment(`b${scope.id}:${anchor}`);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  const previous = new Map<unknown, Item>();
  const others: Node[] = [];
  let position = 0;
  for (let node = start.nextSibling; node && node !== end;) {
    const data = node.nodeType === 8 ? (node as Comment).data : undefined;
    // An item between `<!--i…-->` and `<!--/i-->`, or one element whose `b-b` names the scope.
    const id = data
      ? /^i(-?[\d.]+)$/.exec(data)?.[1]
      : (node as Element).getAttribute?.('b-b')?.split(':')[0];
    const item = id === undefined ? undefined : scopes.get(parseId(id));
    let last: Node = node;
    // The elements of the fallback have scopes of its kinds.
    if (item && (data || (item.p === scope && !fallbackKinds.includes(item.k)))) {
      if (data) {
        last = rangeEnd(node as Comment);
      }
      const nodes = [node];
      for (let current = node; current !== last;) {
        nodes.push((current = current.nextSibling!));
      }
      previous.set(key(item.i, position++), { scope: item, nodes });
    } else {
      others.push(node);
    }
    node = last.nextSibling;
  }

  if (items.length === 0) {
    if (previous.size === 0 && others.length > 0) {
      return;
    }
    for (const item of previous.values()) {
      destroy(item.scope);
    }
    clear(start, end);
    if (fallback) {
      insertHTML(end, fallback(scope));
    }
    return;
  }

  disposeKinds(scope, fallbackKinds);
  for (const node of others) {
    node.parentNode?.removeChild(node);
  }
  const parent = end.parentNode!;
  // The first node after the items placed so far. An item already there is not
  // moved, because moving a node restarts its animations and drops its focus.
  let cursor: Node = start.nextSibling!;
  // New items next to each other go into the page with one insert.
  let added = '';
  const flush = (): void => {
    if (added) {
      insertHTML(cursor, added);
      added = '';
    }
  };
  items.forEach((value, index) => {
    const id = key(value, index);
    const item = previous.get(id);
    if (item) {
      // Before the item's updates run, so they see the new items before it.
      flush();
      previous.delete(id);
      // Slots that keep their values do not trigger updates.
      assign(item.scope, value, index);
      if (item.nodes[0] === cursor) {
        cursor = item.nodes.at(-1)!.nextSibling!;
      } else {
        for (const node of item.nodes) {
          parent.insertBefore(node, cursor);
        }
      }
    } else {
      added += render(scope, value, index);
    }
  });
  flush();
  for (const item of previous.values()) {
    destroy(item.scope);
    for (const node of item.nodes) {
      node.parentNode?.removeChild(node);
    }
  }
}

/** Sets a style variable on the top-level elements of a component instance. */
export function setVar(scope: Scope, name: string, value: unknown): void {
  const css = value === null || value === undefined || value === false ? '' : String(value);
  for (const element of document.querySelectorAll<HTMLElement>(`[b-v="${scope.id}"]`)) {
    element.style.setProperty(name, css);
  }
}

/** The scope that provides a context to `scope`: itself or the nearest one above it. */
function findProvider(scope: Scope, key: string): Scope | undefined {
  for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
    if (current.v && key in current.v) {
      return current;
    }
  }
  return undefined;
}

/** Writes a provided value, and the slot of every scope that reads it from this provider. */
export function updateContext(scope: Scope, context: ContextValue<unknown>, value: unknown): void {
  scope.v ??= {};
  scope.v[context.key] = value;
  for (const target of scopes.values()) {
    const slot = target.x?.[context.key];
    if (slot !== undefined && findProvider(target, context.key) === scope) {
      set(target, slot, value);
    }
  }
}

/** Sets the title of the page. */
export function title(value: unknown): void {
  setTitle(value === null || value === undefined ? '' : String(value));
}

/**
 * Sets `document.title`, which writes the first `<title>` of the document.
 * The head gets a `<title>` of its own first, so a `<title>` in markup keeps its text.
 */
function setTitle(text: string): void {
  if (!document.head.querySelector('title:not([b-t])')) {
    document.head.prepend(document.createElement('title'));
  }
  document.title = text;
}

/** Watches the `<title>` elements of markup, once one is in the page. */
let titleObserver: MutationObserver | undefined;

const PAGE_TITLE = 'title[b-t]';

/** True when a node is or holds a `<title>` of markup. */
function holdsTitle(node: Node): boolean {
  return node instanceof Element && (node.matches(PAGE_TITLE) || !!node.querySelector(PAGE_TITLE));
}

/** Gives the page the text of its last `<title>` in markup. Without one, the title stays. */
function syncTitle(): void {
  const titles = document.querySelectorAll(PAGE_TITLE);
  const last = titles[titles.length - 1];
  if (last && document.title !== last.textContent) {
    setTitle(last.textContent ?? '');
  }
}

/**
 * Starts to follow the `<title>` elements of markup, when `root` has one. A
 * block that adds or removes one, or a change of its text, sets the title.
 */
function watchTitles(root: ParentNode): void {
  if (titleObserver || !root.querySelector(PAGE_TITLE)) {
    return;
  }
  titleObserver = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (
        target?.closest(PAGE_TITLE) ||
        [...record.addedNodes].some(holdsTitle) ||
        [...record.removedNodes].some(holdsTitle)
      ) {
        syncTitle();
        return;
      }
    }
  });
  titleObserver.observe(document, { childList: true, subtree: true, characterData: true });
}

/** Writes a prop of a child component. */
export function prop(scope: Scope, anchor: number, name: string, value: unknown): void {
  const id = scope.c?.[anchor];
  const child = id === undefined ? undefined : scopes.get(id);
  if (!child?.m) {
    return;
  }
  const apply = (module: ClientModule): void => {
    const slot = module.props[name];
    if (slot !== undefined) {
      // A promise loads as an async memo does: the prop keeps its value, and is pending until it settles.
      if (isThenable(value)) {
        asyncMemo(child, slot, Promise.resolve(value));
      } else {
        set(child, slot, value);
      }
      return;
    }
    const all = module.props['*'];
    if (all !== undefined) {
      set(child, all, { ...(get(child, all) as object), [name]: value });
    }
  };
  const module = modules.get(child.m);
  if (module) {
    apply(module);
  } else {
    void loadModule(child.m).then(apply);
  }
}

/** Runs an effect or a `$client` callback, after the cleanup of its previous run. */
export function effect(scope: Scope, name: string, callback: () => unknown): void {
  // In a hidden `#offscreen` body, it runs when the body shows.
  if (hiding?.paused(scope, name)) {
    return;
  }
  scope.cleanups ??= new Map();
  scope.cleanups.get(name)?.();
  let cleanup: unknown;
  try {
    cleanup = callback();
  } catch (error) {
    // The error goes to the nearest `#try` around the effect. The effect runs again on the next change.
    fail(scope, error);
  }
  // An entry without a cleanup too, so a hidden `#offscreen` body knows what to run again.
  scope.cleanups.set(name, typeof cleanup === 'function' ? (cleanup as () => void) : noop);
}

function noop(): void {}

/** Renders the attributes of a form or button that posts to a server function. */
export function action(name: string, id: string, method?: string, result?: string): string {
  return actionAttributes(rpcPrefix, name, id, method, result, build);
}

/**
 * Sends a form of an `$action`. The code is in `rpc.ts`, which every server
 * call loads, so the core holds only this.
 */
export function submitAction(form: HTMLFormElement, submitter: HTMLElement | null): void {
  void import('./rpc.ts').then((module) => module.sendAction(form, submitter));
}

/** Calls a server function. */
export async function rpc(id: string, args: unknown[]): Promise<unknown> {
  // Read before the import, while the memo that calls it computes.
  const signal = memoSignal();
  return track(import('./rpc.ts').then((module) => module.call(rpcPrefix, id, args, signal)));
}

// Rendering on the client

/** Renders a value inserted in markup. */
export function insert(value: unknown): string {
  return insertValue(value);
}

/** A component's client render function, from its `?brumate-render` module. */
// oxlint-disable-next-line typescript/no-explicit-any -- Components take any props.
export type Component<P = any> = (props: P) => string;

function resolveScope(scope: Scope | ScopeId | undefined): Scope | undefined {
  return typeof scope === 'object' ? scope : scope === undefined ? undefined : scopes.get(scope);
}

/**
 * Renders a child component on the client. With `scope` and `anchor`,
 * records the child's scope so the parent can update its props.
 */
export function component<P>(
  Child: Component<P>,
  props: P,
  _ctx?: unknown,
  scope?: Scope | number,
  anchor?: number,
): string {
  const parent = resolveScope(scope);
  if (parent && anchor !== undefined) {
    parent.c ??= {};
    parent.c[anchor] = nextId;
  }
  if (parent) {
    setOwner(parent);
  }
  return Child(props);
}

export function dynamic(
  tag: unknown,
  attributes: Record<string, unknown>,
  children: Raw | undefined,
  _ctx?: unknown,
  scope?: Scope | number,
): string {
  if (typeof tag === 'function') {
    return component(
      tag as Component,
      children ? { ...attributes, children } : attributes,
      undefined,
      scope,
    );
  }
  const name = String(tag);
  const open = `<${name}${spreadText(attributes)}>`;
  return VOID_ELEMENTS.has(name) ? open : `${open}${children ? rawHTML(children) : ''}</${name}>`;
}

/** Work that waits until rendered markup is in the page. */
export const afterInsert: (() => void)[] = [];

/** The scope that renders the next component, which becomes its owner. */
let owner: Scope | undefined;

// The helpers below are what the server's render context does, for markup that the client
// renders. Each is an export of its own, so a build keeps only those that its components call.

/** Creates a scope for markup that the client renders, and returns its ID. */
export function createScope(kind: number, parent?: Scope | ScopeId, module?: string): number {
  const id = nextId--;
  const parentScope = resolveScope(parent);
  const created: Scope = { id, k: kind, p: parentScope, m: module, s: [], children: new Set() };
  if (module !== undefined && owner) {
    created.o = owner;
    owner = undefined;
  }
  parentScope?.children.add(created);
  treeChanges++;
  scopes.set(id, created);
  return id;
}

/**
 * The ID that `$id()` makes, as the server does. Client scope IDs are
 * negative, so they differ from the server's.
 */
export function makeId(scope: Scope | ScopeId, index: number): string {
  return `b${String(resolveScope(scope)!.id).replace(/\./g, '_')}-${index}`;
}

/** Sets the owner of the next component's root scope. */
export function setOwner(scope: Scope | ScopeId): void {
  owner = resolveScope(scope);
}

/** Provides a value of a context to the scopes inside `scope`. */
export function provideValue<T>(context: ContextValue<T>, value: T, scope: Scope | ScopeId): void {
  const target = resolveScope(scope)!;
  target.v ??= {};
  target.v[context.key] = value;
}

/** Reads a context, and records its slot so that changes to the provided value reach it. */
export function consumeContext<T>(
  context: ContextValue<T>,
  scope: Scope | ScopeId,
  slot?: number,
): T {
  const target = resolveScope(scope)!;
  if (slot !== undefined) {
    target.x ??= {};
    target.x[context.key] = slot;
  }
  const provider = findProvider(target, context.key);
  if (provider) {
    return provider.v![context.key] as T;
  }
  if (context.key === ROUTE_KEY && !globals.has(ROUTE_KEY)) {
    globals.set(ROUTE_KEY, currentRoute());
  }
  return (globals.has(context.key) ? globals.get(context.key) : context.defaultValue) as T;
}

/** The values of the contexts that the runtime provides to the whole page, by key. */
const globals = new Map<string, unknown>();

/** The route of the page: `location`, and the params of the route from the last page state. */
function currentRoute(): Route {
  const records = document.querySelectorAll('script[b-state][b-params]');
  const params = records[records.length - 1]?.getAttribute('b-params');
  const url = new URL(location.href);
  return { url, search: url.searchParams, params: params ? JSON.parse(params) : {} };
}

/**
 * Writes a context that the runtime provides to the whole page, and the
 * slot of every scope that reads it without a provider above it.
 */
export function setGlobal(key: string, value: unknown): void {
  globals.set(key, value);
  for (const target of scopes.values()) {
    const slot = target.x?.[key];
    if (slot !== undefined && !findProvider(target, key)) {
      set(target, slot, value);
    }
  }
}

/** Reads the route of the page again, after navigation changed it. */
export function updateRoute(): void {
  setGlobal(ROUTE_KEY, currentRoute());
}

/**
 * Slots that the render of a component in the browser filled with a promise,
 * by `scope:slot`. The first compute of their memo takes that promise
 * instead of calling again, so a server function is called once per row.
 */
const renderedLoads = new Set<string>();

export function setSlots(id: ScopeId, values: unknown[]): void {
  scopes.get(id)!.s = values;
  // A render function computes a memo that loads as a promise, which the first compute of the
  // memo takes. Its failure is the memo's to report, not an unhandled rejection.
  values.forEach((value, slot) => {
    if (isThenable(value)) {
      renderedLoads.add(`${id}:${slot}`);
      Promise.resolve(value).catch(noop);
    }
  });
}

export function setItem(id: ScopeId, value: unknown): void {
  scopes.get(id)!.i = value;
}

export function elementAt(scope: ScopeId, anchor: number): ElementReference {
  return new ElementReference(scope, anchor);
}

/**
 * Warns in development that the browser renders a `#defer` block of a
 * component, such as inside a `#client` body of its parent. Only the server
 * renders the body, so the fallback stays.
 */
export function deferInBrowser(id: string): void {
  if (DEV) {
    console.warn(
      `${id} renders a #defer block in the browser, so it shows its fallback only. Render the component in markup that the server renders.`,
    );
  }
}

/** Adds the markup of a `#head` block to the document's head. */
export function addHead(html: string): void {
  afterInsert.push(() => insertHTML({ parent: document.head }, html));
}

/** Adds the markup of a `#portal` block at the end of the page, after the markup around it. */
export function addPortal(html: string): void {
  afterInsert.push(() => insertHTML({ parent: document.body }, html));
}

/** Adds a component's stylesheet to the page, if the server did not. */
export function addStyle(id: string, css: string): string {
  if (!document.querySelector(`style[b-style="${id}"]`)) {
    const sheet = document.createElement('style');
    sheet.setAttribute('b-style', id);
    sheet.textContent = css;
    document.head.append(sheet);
  }
  return '';
}

/** A function prop rendered on the client calls the parent's exported handler. */
export function handlerProp(value: unknown, ref: string, scope: Scope | number): unknown {
  if (typeof value !== 'function') {
    return value;
  }
  const instance = resolveScope(scope);
  return (...args: unknown[]) => call(ref, instance, args);
}

/**
 * What the loader calls. It is one export, so the loader's import of the core
 * names one export, and a build keeps the rest only when components call them.
 */
export const loader: {
  init: typeof init;
  handle: typeof handle;
  dispose: typeof dispose;
  submitAction: typeof submitAction;
  setGlobal: typeof setGlobal;
  updateRoute: typeof updateRoute;
} = { init, handle, dispose, submitAction, setGlobal, updateRoute };
