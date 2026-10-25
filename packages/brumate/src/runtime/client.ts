import { trustedHTML } from './trusted.ts';
import { loadOnce } from './skew.ts';
import {
  VOID_ELEMENTS,
  actionAttributes,
  attributeText,
  insertValue,
  bindEntry,
  handlerEntry,
  onValue,
  spread as spreadText,
  textValue,
} from './html.ts';
import type { NavigationReport } from './navigate.ts';
import type { SerialEntry } from './values.ts';
import type { Raw } from './html.ts';
import {
  Binding,
  CHILDREN,
  ChildrenReference,
  ElementReference,
  FunctionReference,
  ITEM,
  ITEM_SLOT,
  MODULE,
  OWNER,
  PREFIX,
  SOURCE,
  SlotReference,
  isAsyncIterable,
  isBinding,
  isSlotReference,
  useSerialEntry,
  parseId,
  stateValues,
} from './shared.ts';
import type { PackedState, PageState, ScopeId, ScopeState } from './shared.ts';
import { ROUTE_KEY } from './context.ts';
export { navigationContext, routeContext } from './context.ts';
import type { Context as ContextValue, Route } from './context.ts';

export {
  affix,
  attribute,
  classAttribute,
  escape,
  mergeAttributes,
  onAttribute,
  raw,
  vars,
} from './html.ts';
export type { Raw } from './html.ts';
export { produce } from './produce.ts';
// For `client-routes.ts`, which reads the core with `import()`.
export { ElementReference, FunctionReference, SlotReference, unbind } from './shared.ts';
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
  return /^[hct]\d/.test(name) ? name : 'update';
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
  /** The root scopes of the components that this scope rendered, which go with it. */
  owned?: Set<Scope>;
  /** For children that a component inserted, the scope where they are, for contexts. */
  t?: Scope;
  /** The values that the scope provides, by context key. */
  v?: Record<string, unknown>;
  /** The slots that hold the contexts that the scope reads, by context key. */
  x?: Record<string, number>;
  /** The slots of a parent that the bound props of a component write, by the slot of the prop. */
  /**
   * What the bound props write, by the slot of the prop: a slot of a parent,
   * or the setter of `$bind(name, fn)`, as a function or a reference.
   */
  b?: Record<number, unknown>;
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
  /** The exports of the serial entry, for the values of the app in the page state. */
  serial?: SerialEntry;
  /**
   * Imports the client module of a component. Undefined for a component that
   * has no client code, which a build leaves out.
   */
  load: (id: string) => Promise<ClientModule> | undefined;
  /** Loads the bundle of a root component of the page, before the modules in it. */
  loadBundle?: (id: string) => Promise<unknown> | undefined;
  /** Imports a part of a module, once for each part, as the loader preloads it. */
  loadPart?: (module: ClientModule, part: string) => Promise<Part>;
  /** Adds event listeners for the `b-on` attributes in new markup. */
  listen: (root: ParentNode) => void;
  /** Tells the loader that the markup that `listen` scanned is in the page now. */
  inserted?: () => void;
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
    /** Runs the code of a reference for an element, as an event or a trigger does. */
    handle?: (element: Element, ref: string, event?: Event) => Promise<unknown>;
  }): void;
  /** A handler starts for an event. */
  handler?(ref: string, element: Element, event?: Event): void;
  /** A part of a component's client code loaded. */
  part?(component: string, name: string): void;
  /**
   * A handler ran: when its event came, when its code was ready and the
   * handlers before it had started, when the call returned, and what it
   * returned, which is a promise for an async handler.
   */
  handled?(run: {
    ref: string;
    element: Element;
    event?: string;
    begun: number;
    ready: number;
    end: number;
    result: unknown;
  }): void;
  /** The updates of a write ran: how many, and how long they took with their effects. */
  updated?(count: number, start: number, end: number): void;
  /**
   * Code of a component starts to load: its entry, or a part, and why.
   * `done` settles when it has loaded.
   */
  load?(component: string, part: string, reason: string, done: Promise<unknown>): void;
  /** The loader asks the server for the body of a `#defer` block. */
  defer?(template: Element, done: Promise<unknown>): void;
  /** A slot got a new value. */
  write?(scope: Scope, slot: number, value: unknown): void;
  /**
   * An effect or a `$client` callback, by its name in the update code, ran
   * and took `time` milliseconds, or its cleanup ran.
   */
  effect?(scope: Scope, name: string, kind: 'run' | 'cleanup', time: number): void;
  /** A client navigation changed the page: the routes that stayed, and those it replaced. */
  navigated?(report: NavigationReport): void;
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

/** True while `refresh` runs the updates of scopes that the server rendered. */
let refreshing = false;

/**
 * Updates scopes that the server rendered before values changed on the
 * client, such as the body of a `#loading` block that streams in after an
 * event. Effects do not run: they run only when a value changes. With
 * `memosOnly`, as for scopes that the client just rendered with its values,
 * only the memos run, so the ones that load start.
 */
function refresh(added: Scope[], memosOnly = false): void {
  // The scopes of each module, which load it once.
  const byModule = new Map<string, Scope[]>();
  for (const scope of added) {
    const id = rootOf(scope).m;
    if (!id) {
      continue;
    }
    const list = byModule.get(id);
    if (list) {
      list.push(scope);
    } else {
      byModule.set(id, [scope]);
    }
  }
  for (const [id, list] of byModule) {
    void loadModule(id, 'state').then(async (module) => {
      // The names of the updates of each kind of scope, memos first, so the other updates read
      // their new values.
      const byKind = new Map<number, string[]>();
      for (const scope of list) {
        if (!byKind.has(scope.k)) {
          byKind.set(scope.k, refreshNames(module, scope.k, memosOnly));
        }
      }
      let any = false;
      for (const names of byKind.values()) {
        any ||= names.length > 0;
      }
      if (!any) {
        return;
      }
      const updates = await loadPart(module, 'update', 'state');
      // The updates can render templates and call functions of other components.
      await codeReady();
      refreshing = true;
      try {
        for (const scope of list) {
          for (const name of byKind.get(scope.k)!) {
            if (scopes.has(scope.id)) {
              (updates[name] as (scope: Scope) => void)(scope);
            }
          }
        }
      } finally {
        refreshing = false;
      }
    });
  }
}

/** The names of the updates of a kind of scope that `refresh` runs, memos first. */
function refreshNames(module: ClientModule, kind: number, memosOnly: boolean): string[] {
  const memos = new Set<string>();
  const others = new Set<string>();
  for (const slots of Object.values(module.g)) {
    for (const entries of Object.values(slots)) {
      for (const [entryKind, name] of entries) {
        if (entryKind !== kind || name[0] === 'e') {
          continue;
        }
        if (name[0] === 'm') {
          memos.add(name);
        } else if (!memosOnly) {
          others.add(name);
        }
      }
    }
  }
  return [...memos, ...others];
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
      b: record.b,
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
      if (scope.o) {
        (scope.o.owned ??= new Set()).add(scope);
      }
    }
    if (record.t !== undefined) {
      scope.t = scopes.get(record.t);
    }
  }
  // The bundles of the roots first, so the components that they hold load with them.
  for (const scope of added) {
    if (scope.m) {
      void options.loadBundle?.(scope.m)?.catch(() => {});
    }
  }
  for (const scope of added) {
    if (scope.m) {
      loadComponent(scope.m);
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
    // The new code loads when a scope of the component is read or rendered again.
    pageComponents.delete(id);
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
  unindexed.length = 0;
  rendered.length = 0;
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
  if (value.serial) {
    useSerialEntry(value.serial);
  }
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
    devtools()?.attach?.({ scopes, set, handle });
  }
}

/**
 * The handlers that the core makes from references, with their references,
 * so a spread in markup that the browser renders passes them on in `b-on`,
 * as a spread on the server does.
 */
const handlerReferences = new WeakMap<object, FunctionReference>();

/** The modifiers that the wrappers of `brumate/events` put on a handler. */
const MODIFIERS = Symbol.for('brumate.modifiers');

/**
 * Renders an object of attributes. With `on`, a handler in it that the core
 * made from a reference goes into `on` as a `b-on` entry, with the scope and
 * the arguments of its reference and the modifiers of its wrappers.
 */
export function spread(attributes: Record<string, unknown>, on?: string[]): string {
  if (on) {
    on.push(...spreadEntries(attributes));
  }
  return spreadText(attributes);
}

/** The `b-on` entries of the handlers and bindings of an object of attributes. */
function spreadEntries(attributes: Record<string, unknown>): string[] {
  const on: string[] = [];
  {
    for (const [name, value] of Object.entries(attributes)) {
      const reference =
        /^on[A-Z]/.test(name) && typeof value === 'function'
          ? handlerReferences.get(value)
          : undefined;
      if (reference) {
        on.push(
          handlerEntry(name, reference.ref, reference.scope, reference.modifiers, reference.args),
        );
      }
      // A binding that a rest prop passed on writes its slot, or calls its setter.
      if ((name === 'value' || name === 'checked') && isBinding(value)) {
        on.push(bindEntry(name, value.ref, setterReference(value.set)));
      }
    }
  }
  return on;
}

/** The reference of the setter of a binding: as the state has it, or of a handler that the core made. */
function setterReference(set: unknown): FunctionReference | undefined {
  if (set instanceof FunctionReference) {
    return set;
  }
  return typeof set === 'function' ? handlerReferences.get(set) : undefined;
}

/** Replaces function references with functions that call them. */
function callable(value: unknown, seen: Set<object>): unknown {
  if (value instanceof ChildrenReference) {
    // The scope can come later in the state, such as of a page that navigation loads.
    return new RenderedChildren(value.scope, value.ref);
  }
  if (value instanceof FunctionReference) {
    if (isTemplate(value.ref)) {
      return templateReference(value.ref, scopes.get(value.scope));
    }
    // The code of the components on the page loads with the page, and handlers and updates wait
    // for it. So the function runs at once and returns its result, as on the server.
    const handler = (...args: unknown[]): unknown => {
      const fn = loadedFunction(value.ref);
      const all = [...(value.args ?? []), ...args];
      return fn
        ? fn(scopes.get(value.scope), ...all)
        : call(value.ref, scopes.get(value.scope), all);
    };
    handlerReferences.set(handler, value);
    return handler;
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

/**
 * Why the core loads code, for the Loading tab of the devtools: an event,
 * a call of a function prop, a template, the scopes of a state record, a
 * write, an error, a reset of `#try`, or a prop of a child.
 */
export type LoadReason =
  | 'event'
  | 'call'
  | 'template'
  | 'state'
  | 'write'
  | 'error'
  | 'reset'
  | 'prop';

export function loadModule(id: string, reason: LoadReason = 'write'): Promise<ClientModule> {
  let promise = loading.get(id);
  if (!promise) {
    // A component without client code has nothing to update.
    promise = Promise.resolve(options.load(id)).then((loaded) => {
      const module = loaded ?? { id, props: {}, g: {} };
      modules.set(id, module);
      return module;
    });
    loading.set(id, promise);
    if (DEV) {
      devtools()?.load?.(id, 'entry', reason, promise);
    }
  }
  return promise;
}

export function loadPart(
  module: ClientModule,
  name: string,
  reason: LoadReason = 'write',
): Promise<Part> {
  const key = `${module.id}:${name}`;
  let promise = parts.get(key);
  if (!promise) {
    let loaded: Promise<Part>;
    if (!module.load) {
      loaded = Promise.resolve(module as unknown as Part);
    } else {
      loaded = options.loadPart ? options.loadPart(module, name) : module.load(name);
    }
    promise = loaded.then((part) => {
      loadedParts.set(key, part);
      if (DEV) {
        devtools()?.part?.(module.id, name);
      }
      return part;
    });
    parts.set(key, promise);
    if (DEV) {
      devtools()?.load?.(module.id, module.load ? name : 'all', reason, promise);
    }
  }
  return promise;
}

type Handler = (scope: Scope | undefined, ...args: unknown[]) => unknown;

/** Waits forever once the page loads again, so no error shows before it goes. */
let reloading: Promise<never> | undefined;

async function resolve(ref: string, reason: LoadReason): Promise<Handler> {
  const [id, name] = ref.split('#') as [string, string];
  try {
    const module = await loadModule(id, reason);
    const part = await loadPart(module, partOf(name), reason);
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

// The previous call of a function prop or a provided function, once it has started.
let lastCall: Promise<unknown> = Promise.resolve();

/**
 * Calls a function of another component, such as a function prop or a provided function. The
 * code of each loads in parallel, but the calls start in the order that they were made, so an
 * `onChange` that an input event calls runs before an `onKeyDown` of a later key. The result is
 * wrapped, so a call that its code makes does not wait for the call around it.
 */
function call(ref: string, scope: Scope | undefined, args: unknown[]): Promise<unknown> {
  const code = codeReady();
  const loaded = code
    ? Promise.all([resolve(ref, 'call'), code]).then(([fn]) => fn)
    : resolve(ref, 'call');
  const started = lastCall.then(() => loaded).then((fn) => ({ value: fn(scope, ...args) }));
  lastCall = started.catch(() => {});
  return started.then((result) => result.value);
}

/** True for a reference to a `#template` that a component got as a prop, such as `Page#t3`. */
function isTemplate(ref: string): boolean {
  return /#t\d/.test(ref);
}

/**
 * The code of the components on the page that is still loading. Handlers, updates and calls of
 * functions of other components wait for it, so the code that they call has loaded.
 */
const loadingCode = new Set<Promise<unknown>>();

/** The components whose code loads, or has loaded, with the page. */
const pageComponents = new Set<string>();

/** Loads the code of a component and all of its parts, as the page reads its scopes. */
function loadComponent(id: string): void {
  // A render module that runs before the core starts, such as in a test, has nothing to load.
  if (options === undefined || pageComponents.has(id)) {
    return;
  }
  pageComponents.add(id);
  // The entry of a component holds all of its code. A load that fails is reported when a
  // handler or an update needs it.
  const code: Promise<unknown> = loadModule(id, 'state')
    .catch(() => {})
    .finally(() => loadingCode.delete(code));
  loadingCode.add(code);
}

/** Resolves when the code of the components on the page has loaded. */
function codeReady(): Promise<unknown> | undefined {
  return loadingCode.size > 0 ? Promise.allSettled(loadingCode) : undefined;
}

/** The function of a reference, such as `Page#h3`, once its code has loaded. */
function loadedFunction(ref: string): Handler | undefined {
  const [id, name] = ref.split('#') as [string, string];
  const module = modules.get(id);
  if (!module) {
    return undefined;
  }
  // A module without `load` holds every part itself.
  const part = module.load ? loadedParts.get(`${id}:${partOf(name)}`) : (module as unknown as Part);
  return part?.[name] as Handler | undefined;
}

/**
 * A `#template` of another component, which renders at once, as markup does. Its code loads
 * with the page, and updates wait for it.
 */
function templateReference(ref: string, scope: Scope | undefined): (...args: unknown[]) => unknown {
  // The markup renders where the component inserts it, so it reads the contexts there, as
  // children do.
  return (...args) =>
    new Children(scope, () => {
      const render = loadedFunction(ref);
      return render ? insertValue(render(scope, ...args)) : '';
    });
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
export function handle(element: Element, entry: string, event?: Event): Promise<unknown> {
  // A handler that a spread passed on, such as `Parent#h1@3`, runs in the scope of its owner.
  // A handler that `$handler` made has its arguments after another `@`.
  const [ref, owner, encoded] = entry.split('@') as [string, string | undefined, string?];
  const bound = encoded ? (JSON.parse(decodeURIComponent(encoded)) as unknown[]) : [];
  const anchor = owner ?? element.closest('[b-b]')?.getAttribute('b-b')?.split(':')[0];
  const scope = anchor ? scopes.get(parseId(anchor)) : undefined;
  // A callback that the browser runs later, such as a `$client` callback for when the page is
  // idle, does not run once its element and its scope are gone, such as after the block or the
  // page that held it was removed.
  if (anchor && !scope && !element.isConnected) {
    return Promise.resolve();
  }
  // A `<window>` or `<document>` listener in a hidden `#offscreen` body does not run.
  if (scope && hiding?.hidden(scope) && element.hasAttribute('b-listen')) {
    return Promise.resolve();
  }
  // `value=$bind(name)` on an element: the core writes the slot of the name, `hops` parents up
  // from the element's scope, from the value of the element, or whether a box is checked.
  // `value=$bind(name, fn)`: the setter takes the value of the element. A ref names its scope
  // after `@`, so the prefix is `$set:`.
  if (ref.startsWith('$set:')) {
    const field = element as HTMLInputElement;
    return call(ref.slice(5), scope, [
      /^(checkbox|radio)$/i.test(field.type) ? field.checked : field.value,
    ]);
  }
  if (ref.startsWith('$bind#')) {
    const [hops = 0, slot = 0] = ref.slice(6).split('.').map(Number);
    let target = scope;
    for (let hop = 0; hop < hops; hop++) {
      target = target?.p;
    }
    const field = element as HTMLInputElement;
    if (target) {
      set(target, slot, /^(checkbox|radio)$/i.test(field.type) ? field.checked : field.value);
    }
    return Promise.resolve();
  }
  const args = event ? [...bound, withTarget(event, element)] : bound;
  const begun = DEV ? performance.now() : 0;
  if (DEV) {
    devtools()?.handler?.(ref, element, event);
  }
  // Parts load in parallel, but handlers start in the order of their events,
  // so an input handler runs before the submit handler of a later event.
  // The code of the children that the handler can insert loads with it.
  // So does the code of the page, which the handler can call.
  const children = childrenReady(scope);
  const code = codeReady();
  const loaded =
    children || code
      ? Promise.all([resolve(ref, 'event'), children, code]).then(([handler]) => handler)
      : resolve(ref, 'event');
  const started = lastHandler
    .then(() => loaded)
    .then((handler) => {
      if (!DEV) {
        return { value: handler(scope, ...args) };
      }
      const ready = performance.now();
      const value = handler(scope, ...args);
      devtools()?.handled?.({
        ref,
        element,
        event: event?.type,
        begun,
        ready,
        end: performance.now(),
        result: value,
      });
      return { value };
    });
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
      const module = await loadModule(id, 'error');
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
  const updates = await loadPart(module, 'update', 'error');
  const start = findComment(`b${owner.id}:${anchor}`);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  removeBlock(owner, kinds, start, end);
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

/**
 * Writes a slot from code of a component. A prop that a parent bound with
 * `$bind` writes the parent's slot too, through any number of levels, and
 * the parent's update of the prop then finds the value already there. A
 * binding with a setter, `$bind(name, fn)`, calls it in place of the write,
 * and the parent's update of the prop writes the value that it keeps.
 */
export function set<T>(scope: Scope, slot: number, value: T): T {
  const bound = scope.b?.[slot];
  if (bound === undefined || isSlotReference(bound)) {
    writeSlot(scope, slot, value);
    const target = bound && scopes.get(bound.scope);
    if (target) {
      set(target, bound.slot, value);
    }
  } else if (bound instanceof FunctionReference) {
    void call(bound.ref, scopes.get(bound.scope), [...(bound.args ?? []), value]);
  } else if (typeof bound === 'function') {
    void bound(value);
  }
  return value;
}

/** Writes a slot, and updates what reads it. */
function writeSlot(scope: Scope, slot: number, value: unknown): void {
  if (!Object.is(scope.s[slot], value)) {
    writes++;
    scope.s[slot] = value;
    if (DEV) {
      devtools()?.write?.(scope, slot, value);
    }
    trigger(scope, slot);
  }
}

/** What `$bind(name)` passes a child, in markup that the browser renders. */
export function binding<T>(
  value: T,
  scope: Scope | ScopeId,
  slot: number,
  set?: unknown,
): Binding<T> {
  return new Binding(
    value,
    new SlotReference(typeof scope === 'object' ? scope.id : scope, slot),
    set,
  );
}

/**
 * Records the props that a parent bound with `$bind`, among the props that a
 * component the browser renders writes: `slots` has the slot of each, by its name.
 */
export function bindings(
  scope: Scope | ScopeId,
  props: Record<string, unknown>,
  slots: Record<string, number>,
): void {
  const target = typeof scope === 'object' ? scope : scopes.get(scope);
  for (const [name, slot] of Object.entries(slots)) {
    const value = props[name];
    if (target && isBinding(value)) {
      (target.b ??= {})[slot] = value.target;
    }
  }
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

/** True when a parent bound the prop of the slot with `$bind`. */
export function isBound(scope: Scope, slot: number): boolean {
  return scope.b?.[slot] !== undefined;
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
  const children = childrenReady(scope);
  if (module && updates && loadingCode.size === 0 && !children) {
    run(module, updates, scope, slot);
    return;
  }
  // The first write to a component loads its update code. Later writes wait in order, and
  // for the code of the page, which the updates can render and call.
  const loading = loadModule(id).then(async (loaded) => {
    if (loaded.g[scope.k]?.[slot]) {
      const code = await loadPart(loaded, 'update');
      await Promise.allSettled([...loadingCode, children]);
      run(loaded, code, scope, slot);
    }
  });
  loadingUpdates.add(loading);
  void loading.finally(() => loadingUpdates.delete(loading));
}

/** The updates that wait for their code. */
const loadingUpdates = new Set<Promise<unknown>>();

/**
 * Resolves when the updates of the writes so far have run, including those
 * whose code is loading. `transition` of `brumate/events` waits for it.
 */
export async function updated(): Promise<void> {
  while (loadingUpdates.size > 0) {
    // oxlint-disable-next-line no-await-in-loop -- An update can start more loads.
    await Promise.allSettled(loadingUpdates);
  }
}

(globalThis as { [key: symbol]: unknown })[Symbol.for('brumate.updated')] = updated;

// Effects wait until every other update of a write has run, and run once each.
const pendingEffects = new Map<string, () => void>();
let running = 0;
let flushing = false;
/** Counts changes to the scope tree, so `run` knows when the descendants it found are out of date. */
let treeChanges = 0;

/** The updates that ran since the outermost `run` started, and when it started, for the devtools. */
let updateCount = 0;
let updateStart = 0;

function run(module: ClientModule, updates: Part, scope: Scope, slot: number): void {
  if (DEV && running === 0) {
    updateCount = 0;
    updateStart = performance.now();
  }
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
    if (DEV) {
      devtools()?.updated?.(updateCount, updateStart, performance.now());
    }
  }
}

/** Runs an update on a scope. An effect waits until the other updates have run. */
function runUpdate(fn: (scope: Scope) => void, name: string, target: Scope): void {
  if (DEV) {
    updateCount++;
  }
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
  // A scope that a block already removed, such as one that is both owned and in the range.
  if (scopes.get(scope.id) !== scope) {
    return;
  }
  if (scope.children.size > 0) {
    for (const child of Array.from(scope.children)) {
      destroy(child);
    }
  }
  // The components that it rendered have no parent, so they go through their owner.
  if (scope.owned) {
    for (const child of Array.from(scope.owned)) {
      destroy(child);
    }
  }
  // The content of a `#portal` is elsewhere in the page, so it is removed by its markers.
  const start = portals > 0 ? comments.get(`P${scope.id}`) : undefined;
  if (start?.isConnected) {
    const end = rangeEnd(start);
    // The components in it go too, such as children that a component inserted there.
    destroyRange(scope, start, end);
    clear(start, end);
    start.remove();
    end.remove();
  }
  removeScope(scope);
  sweepIndexes();
}

/**
 * Removes a scope from the page: its cleanups run, and its memo state goes,
 * so a load that settles later is not written. Its markup stays.
 */
export function removeScope(scope: Scope): void {
  if (scope.cleanups) {
    for (const cleanup of scope.cleanups.values()) {
      cleanup();
    }
  }
  // The state of the slots that load or wait, which most scopes, such as rows of a list, have not.
  const waiting =
    memoControllers.size + timers.size + loads.size + loadingSlots.size + (guesses?.map.size ?? 0);
  for (let slot = 0; waiting > 0 && slot < scope.s.length; slot++) {
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
  scope.o?.owned?.delete(scope);
  treeChanges++;
}

/**
 * Removes the markup of a block of `scope`, between its markers, with the scopes in it: the
 * scopes of its kinds, and the scopes whose markup is in it. Those are the components that the
 * block rendered, whose owner can be `scope` itself, and the children that a component inserted
 * there. A scope that holds `scope` keeps its markers in the block, so it stays.
 */
function removeBlock(scope: Scope, kinds: number[], start: Node, end: Node): void {
  disposeKinds(scope, kinds);
  destroyRange(scope, start, end);
  clear(start, end);
}

/**
 * Destroys the scopes whose markup is between two nodes, such as the components of a block that
 * closes, but not the scope of the block or those around it.
 */
function destroyRange(scope: Scope, start: Node, end: Node): void {
  if (scopes.size > 0 && start.nextSibling !== end) {
    const above = new Set<Scope>();
    for (let current: Scope | undefined = scope; current; current = current.p ?? current.o) {
      above.add(current);
    }
    const inside = new Set<Scope>();
    const add = (id: string): void => {
      const found = scopes.get(parseId(id));
      if (found && !above.has(found)) {
        inside.add(found);
      }
    };
    for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) {
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
      );
      for (let current: Node | null = walker.currentNode; current; current = walker.nextNode()) {
        if (current.nodeType === 1) {
          const key = (current as Element).getAttribute('b-b');
          if (key !== null) {
            add(key.slice(0, key.indexOf(':')));
          }
        } else if (MARKER.test((current as Comment).data)) {
          add((current as Comment).data.slice(1).split(':')[0]!);
        }
      }
    }
    for (const found of inside) {
      destroy(found);
    }
  }
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

const SCOPE_MARKER = /^[tb](-?[\d.]+):/;

/** True for markup that names a scope from the server: a `b-b` or marker with an ID that is not negative. */
const SERVER_SCOPES = /b-b="\d|<!--[tb]\d/;

/** The scopes that the client made since the last insert, which the next insert holds. */
const rendered: Scope[] = [];

/** How many `#portal` markers the page has had, so a scope looks for its own only when any have. */
let portals = 0;

/**
 * Indexes the markers and the bound elements under `root`, so that updates find them without a
 * search of the page. A search for each row of a long list takes time that grows with the list.
 * With `ids`, it also collects the IDs of the scopes that the markup names. The IDs of scopes
 * that the client made are negative.
 */
function indexMarkers(root: Node, ids?: Set<ScopeId>, withElements = true): void {
  // The query finds the bound elements in native code, and the walk visits only comments, so
  // the code here runs for each marker, not for each node of a long list.
  if (withElements) {
    indexElements(root, ids);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Comment).data;
    if (!MARKER.test(data)) {
      continue;
    }
    comments.set(markerKey(data), node as Comment);
    if (data[0] === 'P') {
      portals++;
    }
    const match = ids && SCOPE_MARKER.exec(data);
    if (match) {
      ids!.add(parseId(match[1]!));
    }
  }
}

/** The size of the indexes at which they next drop the nodes that left the page. */
let sweepAt = 4096;

/**
 * Drops the nodes that left the page from the indexes, once they have grown to twice their size
 * after the last sweep, so a list that the client fills and empties again does not keep its old
 * rows. A node that comes back is indexed again when it is inserted.
 */
function sweepIndexes(): void {
  if (comments.size + elements.size < sweepAt) {
    return;
  }
  for (const [key, node] of comments) {
    if (!node.isConnected) {
      comments.delete(key);
    }
  }
  for (const [key, node] of elements) {
    if (!node.isConnected) {
      elements.delete(key);
    }
  }
  sweepAt = Math.max(4096, 2 * (comments.size + elements.size));
}

function indexElements(root: Node, ids?: Set<ScopeId>): void {
  if (root.nodeType === 1) {
    indexElement(root as Element, ids);
  }
  if (root.nodeType === 1 || root.nodeType === 9 || root.nodeType === 11) {
    for (const element of (root as ParentNode).querySelectorAll('[b-b]')) {
      indexElement(element, ids);
    }
  }
}

/**
 * The nodes that inserts of the client put in the page, from the first to the last of each,
 * whose bound elements are not indexed yet. A list that the client creates is often never
 * updated row by row, so its elements are indexed when an update first needs one of them.
 */
const unindexed: [first: Node, last: Node][] = [];

function indexInserts(): void {
  for (const [first, last] of unindexed.splice(0)) {
    if (first.isConnected) {
      for (let node: Node | null = first; node; node = node.nextSibling) {
        indexElements(node);
        if (node === last) {
          break;
        }
      }
    } else if (last.isConnected) {
      // The first nodes left the page, such as the first rows of a list that were removed, so
      // the walk goes back from the last node, past the start of the insert if it must.
      for (let node: Node | null = last; node; node = node.previousSibling) {
        indexElements(node);
      }
    }
  }
}

function indexElement(element: Element, ids?: Set<ScopeId>): void {
  const key = element.getAttribute('b-b');
  if (key === null) {
    return;
  }
  elements.set(key, element);
  ids?.add(parseId(key.slice(0, key.indexOf(':'))));
}

/** Indexes the markers in the nodes that mutation records added. */
function indexAdded(records: MutationRecord[]): void {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === 1) {
        indexMarkers(node);
      } else if (node.nodeType === 8 && MARKER.test((node as Comment).data)) {
        const data = (node as Comment).data;
        comments.set(markerKey(data), node as Comment);
        if (data[0] === 'P') {
          portals++;
        }
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
    // As for markers: once the core starts, the index has every bound element in the page,
    // with those of the inserts that are waiting.
    if (markerObserver) {
      indexAdded(markerObserver.takeRecords());
      indexInserts();
      element = elements.get(key);
    }
    // An insert whose first node left the page, such as the first row of a list that was
    // removed, has elements that the walk did not reach.
    if (!element?.isConnected) {
      element = document.querySelector(`[b-b="${key}"]`) ?? undefined;
      if (element) {
        elements.set(key, element);
      }
    }
  }
  return element?.isConnected ? element : null;
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
  if (start.nextSibling === end || !start.nextSibling) {
    return;
  }
  // One removal of the whole range, which costs less than one for each node of a long list.
  const range = document.createRange();
  range.setStartAfter(start);
  range.setEndBefore(end);
  range.deleteContents();
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
  // The scopes that the renders since the last insert made, whose markup this is.
  const client = rendered.splice(0);
  // Markup from the server, such as `children`, names scopes with IDs that are not negative.
  // Only then are the elements of the insert read for them now.
  const fromServer = SERVER_SCOPES.test(html);
  const ids = fromServer ? new Set<ScopeId>() : undefined;
  indexMarkers(fragment, ids, fromServer);
  options.listen(fragment);
  watchTitles(fragment);
  const server: Scope[] = [];
  for (const id of ids ?? []) {
    const scope = typeof id === 'number' && id < 0 ? undefined : scopes.get(id);
    if (scope) {
      server.push(scope);
    }
  }
  if (!fromServer && fragment.firstChild) {
    unindexed.push([fragment.firstChild, fragment.lastChild!]);
    // Many inserts that no update read are indexed at once, so they do not hold their nodes.
    if (unindexed.length > 256) {
      indexInserts();
    }
  }
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
  // The records of this insert, whose markers are indexed and whose handlers listen already.
  markerObserver?.takeRecords();
  options.inserted?.();
  for (const fn of afterInsert.splice(0)) {
    fn();
  }
  // HTML from the server, such as `children`, can be older than the values on the client.
  if (server.length > 0) {
    refresh(server);
  }
  // Scopes that the client just rendered have its values, but the memos that load start here.
  const live = client.filter((scope) => scopes.has(scope.id));
  if (live.length > 0) {
    refresh(live, true);
  }
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
    write(start.parentNode!, start.nextSibling, rangeEnd(start), value, scope);
  }
}

/** Writes an inserted value that is the whole content of the element with the anchor. */
export function content(scope: Scope, anchor: number, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    write(element, element.firstChild, null, value, scope);
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
    // Each is written only when it differs, as a write of the same text still notifies observers.
    if (element.textContent !== written) {
      element.textContent = written;
    }
    if (element instanceof HTMLTextAreaElement && element.value !== written) {
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
  at?: Scope,
): void {
  if (
    (typeof value === 'string' || typeof value === 'number') &&
    first?.nodeType === 3 &&
    first.nextSibling === end
  ) {
    // Hidden text keeps its new value for when it shows.
    const saved = hiding?.nodes.get(first);
    const text = String(value);
    if (saved) {
      saved.v = text;
    } else if ((first as Text).data !== text) {
      // The same text again changes nothing, and a write would still notify observers.
      (first as Text).data = text;
    }
    return;
  }
  while (first && first !== end) {
    const next = first.nextSibling;
    first.remove();
    first = next;
  }
  // Children and templates render here, at the scope of the insert, for its contexts.
  insertHTML(end ?? { parent }, value instanceof Children ? value.render(at) : insertValue(value));
}

/** The `value` and `checked` that updates last wrote to each field. */
const fieldValues = new WeakMap<Element, Map<string, unknown>>();

function setAttribute(element: Element, name: string, value: unknown, spread = false): void {
  if (isBinding(value)) {
    value = value.value;
  }
  // A write of the same value changes nothing on screen, yet it still costs a style check and
  // notifies observers, so each write is skipped when the element already has the value.
  if (name === 'value' || name === 'checked') {
    const field = element as unknown as Record<string, unknown>;
    const next = name === 'checked' ? Boolean(value) : String(value ?? '');
    // The field takes the value when it differs from the value that updates wrote last, not each
    // time an update runs, so what the user typed or checked stays while the value stays, such
    // as the posted values of a form that validation reads again. Before the first write, the
    // field is compared as it is now. Two first writes compare it with what the server rendered,
    // so what the user typed or checked before the code loaded stays: an update of a scope that
    // resumed late, and an update of a spread, which another of its attributes can start.
    const written = fieldValues.get(element) ?? new Map<string, unknown>();
    fieldValues.set(element, written);
    let rendered: unknown;
    if (refreshing || spread) {
      rendered = name === 'checked' ? field.defaultChecked : field.defaultValue;
    }
    const before = written.has(name) ? written.get(name) : (rendered ?? field[name]);
    written.set(name, next);
    if (!Object.is(before, next) && field[name] !== next) {
      field[name] = next;
    }
  }
  let written = attributeText(name, value);
  if (name === 'style' && element.hasAttribute('b-v')) {
    written = withVariables(element as HTMLElement, written);
  }
  if (element.getAttribute(name) === (written ?? null)) {
    return;
  }
  if (written === undefined) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, written);
  }
  if (name === 'style') {
    hiding?.styled(element);
  }
}

/**
 * A new style for a top-level element of a component, with the style variables of the component
 * that the element has now, so a style that a spread passes on does not remove them.
 */
function withVariables(element: HTMLElement, style: string | undefined): string | undefined {
  const variables: string[] = [];
  for (const property of Array.from(element.style)) {
    // A style that writes the variable itself, such as one that the element's own style
    // attribute builds, keeps its new value alone.
    if (/^--s-[\w-]+-\d+$/.test(property) && !style?.includes(`${property}:`)) {
      variables.push(`${property}:${element.style.getPropertyValue(property)}`);
    }
  }
  if (variables.length === 0) {
    return style;
  }
  return style ? `${variables.join(';')};${style}` : variables.join(';');
}

export function attr(scope: Scope, anchor: number, name: string, value: unknown): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    setAttribute(element, name, value);
  }
}

/** The attributes that the last update of a spread wrote, so the next one removes those it drops. */
const spreadNames = new WeakMap<Element, Set<string>>();

export function attrs(
  scope: Scope,
  anchor: number,
  values: Record<string, unknown>,
  own: string[] = [],
): void {
  const element = findElement(scope.id, anchor);
  if (element) {
    // The first update in the browser takes the attributes that are not the element's own, nor
    // those of brumate, as the ones that the server's spread wrote.
    if (!spreadNames.has(element)) {
      spreadNames.set(
        element,
        new Set(
          element
            .getAttributeNames()
            .filter((name) => !own.includes(name) && !/^(b-|data-prefetch$)/.test(name)),
        ),
      );
    }
    const names = new Set<string>();
    for (const [name, value] of Object.entries(values)) {
      if (name !== 'children' && !/^on[A-Z]/.test(name)) {
        names.add(name);
        setAttribute(element, name, value, true);
      }
    }
    for (const name of spreadNames.get(element) ?? []) {
      if (!names.has(name)) {
        setAttribute(element, name, undefined);
      }
    }
    spreadNames.set(element, names);
    updateSpreadEntries(element, values);
  }
}

/**
 * Writes the handlers and bindings of a spread into `b-on` again, as they are now. The entries of
 * a spread name their scope after `@`, and the element's own entries do not, so those stay.
 */
function updateSpreadEntries(element: Element, values: Record<string, unknown>): void {
  const before = element.getAttribute('b-on') ?? '';
  const own = before
    .split(' ')
    .filter((entry) => entry && !entry.includes('@'))
    .join(' ');
  const after = onValue(spreadEntries(values), own);
  if (after === before) {
    return;
  }
  if (after) {
    element.setAttribute('b-on', after);
  } else {
    element.removeAttribute('b-on');
  }
  // The loader listens to the events of the new entries, and prevents what their wrappers name.
  options.listen(element);
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
  removeBlock(scope, kinds, start, end);
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
  removeBlock(scope, kinds, start, end);
  insertHTML(end, render(scope));
}

/**
 * `rekey` for the block around a dynamic tag. The first update keeps the element that the server
 * rendered, when it has the tag already, such as an update of a scope that streams in after an
 * event.
 */
export function retag(
  scope: Scope,
  anchor: number,
  value: unknown,
  render: Render,
  kinds: number[],
): void {
  scope.keys ??= new Map();
  if (!scope.keys.has(anchor) && typeof value === 'string') {
    const start = findComment(`b${scope.id}:${anchor}`);
    let node = start?.nextSibling;
    while (node && node.nodeType !== 1 && node.nodeType !== 8) {
      node = node.nextSibling;
    }
    if (node?.nodeType === 1 && (node as Element).localName === value.toLowerCase()) {
      scope.keys.set(anchor, value);
      return;
    }
  }
  rekey(scope, anchor, value, render, kinds);
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
  const updates = await loadPart(await loadModule(id, 'reset'), 'update', 'reset');
  const start = findComment(`b${scope.id}:${anchor}`);
  if (!start) {
    return;
  }
  const end = rangeEnd(start);
  removeBlock(scope, kinds, start, end);
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
  removeBlock(scope, kinds, start, end);
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
  /** The first and last node of the item, which are the same node for one element. */
  first: Node;
  last: Node;
  /** The place of the item in the list before the update. */
  position: number;
  /** True for an item whose key is in the new list. */
  kept: boolean;
  /** True for a kept item that stays in place. */
  still: boolean;
}

const ITEM_MARKER = /^i(-?[\d.]+)$/;

/** Updates the items of `#for` or `#repeat`, keeping the elements of items whose keys stay. */
/** The items of a `#for` list: an array as it is, since `list` only reads it, or any iterable as an array. */
export function listOf(value: Iterable<unknown> | ArrayLike<unknown>): unknown[] {
  return Array.isArray(value) ? value : Array.from(value);
}

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
  let others: Node[] | undefined;
  let position = 0;
  for (let node = start.nextSibling; node && node !== end;) {
    // An item between `<!--i…-->` and `<!--/i-->`, or one element whose `b-b` names the scope.
    let data: string | undefined;
    let id: string | undefined;
    if (node.nodeType === 8) {
      data = (node as Comment).data;
      id = ITEM_MARKER.exec(data)?.[1];
    } else if (node.nodeType === 1) {
      const bound = (node as Element).getAttribute('b-b');
      id = bound === null ? undefined : bound.slice(0, bound.indexOf(':'));
    }
    const item = id === undefined ? undefined : scopes.get(parseId(id));
    let last: Node = node;
    // The elements of the fallback have scopes of its kinds.
    if (item && (data !== undefined || (item.p === scope && !fallbackKinds.includes(item.k)))) {
      if (data !== undefined) {
        last = rangeEnd(node as Comment);
      }
      previous.set(key(item.i, position), {
        scope: item,
        first: node,
        last,
        position: position++,
        kept: false,
        still: false,
      });
    } else {
      (others ??= []).push(node);
    }
    node = last.nextSibling;
  }

  const count = items.length;
  if (count === 0) {
    if (previous.size === 0 && others) {
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
  if (others) {
    for (const node of others) {
      node.parentNode?.removeChild(node);
    }
  }
  const parent = end.parentNode!;
  // The key of each item, and the items that stay, in the new order. A key that repeats keeps
  // its item once, as below.
  const keys: unknown[] = Array.from({ length: count });
  const kept: Item[] = [];
  for (let index = 0; index < count; index++) {
    const id = (keys[index] = key(items[index], index));
    const item = previous.get(id);
    if (item && !item.kept) {
      item.kept = true;
      kept.push(item);
    }
  }
  // The items that stay in place: the longest run of them that keeps the old order. Only the
  // others move, because moving a node restarts its animations and drops its focus.
  markInPlace(kept);
  // When no item stays, the old ones go first, in one removal, and the new ones go in after.
  if (kept.length === 0 && previous.size > 0) {
    for (const item of previous.values()) {
      destroy(item.scope);
    }
    previous.clear();
    clear(start, end);
  }
  // The first node after the items placed so far.
  let cursor: Node = start.nextSibling!;
  // New items next to each other go into the page with one insert.
  let added = '';
  for (let index = 0; index < count; index++) {
    const id = keys[index];
    const item = previous.get(id);
    if (!item) {
      added += render(scope, items[index], index);
      continue;
    }
    // Before the item's updates run, so they see the new items before it.
    if (added) {
      insertHTML(cursor, added);
      added = '';
    }
    previous.delete(id);
    // Slots that keep their values do not trigger updates.
    assign(item.scope, items[index], index);
    if (item.still) {
      // The nodes between the cursor and the item belong to items that move or go.
      cursor = item.last.nextSibling!;
    } else {
      for (let node = item.first; ;) {
        const next = node.nextSibling;
        parent.insertBefore(node, cursor);
        if (node === item.last) {
          break;
        }
        node = next!;
      }
    }
  }
  if (added) {
    insertHTML(cursor, added);
  }
  for (const item of previous.values()) {
    destroy(item.scope);
    for (let node: Node | null = item.first; node;) {
      const next: Node | null = node === item.last ? null : node.nextSibling;
      node.parentNode?.removeChild(node);
      node = next;
    }
  }
}

/**
 * Marks the items of a list that keep their places: the longest run of `kept`, the items that
 * stay in their new order, whose old positions go up.
 */
function markInPlace(kept: Item[]): void {
  let sorted = true;
  for (let index = 1; index < kept.length; index++) {
    if (kept[index - 1]!.position > kept[index]!.position) {
      sorted = false;
      break;
    }
  }
  if (sorted) {
    for (const item of kept) {
      item.still = true;
    }
    return;
  }
  // `tails[length - 1]` is the index of the item that ends the run of that length with the
  // lowest position, and `before` links each item to the item before it in its run.
  const tails: number[] = [];
  const before: number[] = [];
  for (let index = 0; index < kept.length; index++) {
    const position = kept[index]!.position;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (kept[tails[middle]!]!.position < position) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    before[index] = low > 0 ? tails[low - 1]! : -1;
    tails[low] = index;
  }
  for (let index = tails.at(-1) ?? -1; index >= 0; index = before[index]!) {
    kept[index]!.still = true;
  }
}

/** Sets a style variable on the top-level elements of a component instance. */
export function setVar(scope: Scope, name: string, value: unknown): void {
  const css = value === null || value === undefined || value === false ? '' : String(value);
  for (const element of document.querySelectorAll<HTMLElement>(`[b-v="${scope.id}"]`)) {
    if (element.style.getPropertyValue(name) !== css) {
      element.style.setProperty(name, css);
    }
  }
}

/** The scope that provides a context to `scope`: itself or the nearest one above it. */
function findProvider(scope: Scope, key: string): Scope | undefined {
  // A scope reads the contexts of the scopes above it, not its own, so a component can read a
  // context and provide it again to the scopes inside it. Children that a component inserted
  // find their contexts where they are, through `t`.
  for (
    let current: Scope | undefined = scope.t ?? scope.p ?? scope.o;
    current;
    current = current.t ?? current.p ?? current.o
  ) {
    if (current.v && key in current.v) {
      return current;
    }
  }
  return undefined;
}

/**
 * Writes a provided value, and the slot of every scope that reads it from this provider. The
 * provider can read the same context from above, which this does not write.
 */
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
// The keys that the spreads of child components passed last, by the child's scope and anchor.
const spreadKeys = new WeakMap<Scope, Map<number, Set<string>>>();

/**
 * Updates the props of a child component from a spread. A key that the
 * spread passed before and no longer has becomes undefined. `after` names
 * the props after the spread, which win over it.
 */
export function spreadProps(
  scope: Scope,
  anchor: number,
  value: Record<string, unknown> | null | undefined,
  after: string[],
): void {
  const byAnchor = spreadKeys.get(scope) ?? new Map<number, Set<string>>();
  spreadKeys.set(scope, byAnchor);
  const before = byAnchor.get(anchor) ?? new Set();
  const keys = new Set(Object.keys(value ?? {}).filter((key) => !after.includes(key)));
  byAnchor.set(anchor, keys);
  for (const key of keys) {
    prop(scope, anchor, key, value![key]);
  }
  for (const key of before) {
    if (!keys.has(key)) {
      prop(scope, anchor, key, undefined);
    }
  }
}

export function prop(scope: Scope, anchor: number, name: string, value: unknown): void {
  // A prop that the parent binds passes its value. The child keeps the slot it writes from its render.
  if (isBinding(value)) {
    value = value.value;
  }
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
        // The parent's value. A bound prop does not write it back.
        writeSlot(child, slot, value);
      }
      return;
    }
    const all = module.props['*'];
    if (all !== undefined) {
      set(child, all, { ...(get(child, all) as object), [name]: value });
    }
    // A rest prop, `...rest`, holds the props that the component does not name.
    const rest = module.props['...'];
    if (rest !== undefined) {
      const next: Record<string, unknown> = { ...(get(child, rest) as object) };
      if (value === undefined) {
        delete next[name];
      } else {
        next[name] = value;
      }
      set(child, rest, next);
    }
  };
  const module = modules.get(child.m);
  if (module) {
    apply(module);
  } else {
    void loadModule(child.m, 'prop').then(apply);
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
  const start = DEV ? performance.now() : 0;
  try {
    cleanup = callback();
  } catch (error) {
    // The error goes to the nearest `#try` around the effect. The effect runs again on the next change.
    fail(scope, error);
  }
  // An entry without a cleanup too, so a hidden `#offscreen` body knows what to run again.
  let stored = typeof cleanup === 'function' ? (cleanup as () => void) : noop;
  if (DEV) {
    devtools()?.effect?.(scope, name, 'run', performance.now() - start);
    // Each way that a cleanup runs calls this function: the next run, a removed scope, a hidden
    // `#offscreen` body, or a page that navigation leaves.
    const own = stored;
    stored = () => {
      devtools()?.effect?.(scope, name, 'cleanup', 0);
      own();
    };
  }
  scope.cleanups.set(name, stored);
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

/** Renders a value inserted in markup. Children render here, at `scope`, for their contexts. */
export function insert(value: unknown, _ctx?: unknown, scope?: Scope | ScopeId): string {
  return value instanceof Children ? value.render(resolveScope(scope)) : insertValue(value);
}

/** Children that render where they are inserted, and the scopes that they find contexts from. */
const insertedChildren: { from: Scope | undefined; at: Scope }[] = [];

/**
 * Children of a component that the client renders. They render where the
 * component inserts them, so they read the contexts that it provides. `from`
 * is the scope of the markup that wrote them.
 */
class Children {
  private given: Scope | ScopeId | undefined;
  private readonly html: () => string;

  constructor(from: Scope | ScopeId | undefined, html: () => string) {
    this.given = from;
    this.html = html;
  }

  /** The scope that the children were written in, found when they render. */
  protected get from(): Scope | undefined {
    const scope = resolveScope(this.given);
    if (scope) {
      this.given = scope;
    }
    return scope;
  }

  render(at: Scope | undefined): string {
    if (!at) {
      return this.html();
    }
    const entry = { from: this.from, at };
    insertedChildren.push(entry);
    try {
      return this.html();
    } finally {
      insertedChildren.splice(insertedChildren.indexOf(entry), 1);
    }
  }
}

/**
 * Children that the server rendered, which the browser renders with their own export each time
 * a component inserts them, so each insert makes new scopes, as the body of a block does. The
 * code of the export loads before the code that can insert them runs. See `childrenReady`.
 */
class RenderedChildren extends Children {
  readonly ref: string;
  private code: Handler | undefined;
  private loading: Promise<void> | undefined;

  constructor(scope: ScopeId, ref: string) {
    // The export returns HTML, as the render of a block does.
    super(scope, () => String(this.code!(this.from)));
    this.ref = ref;
  }

  override render(at: Scope | undefined): string {
    if (this.code && this.from) {
      return super.render(at);
    }
    // An insert that ran before the code, such as an update that a parent ran at once, or before
    // the state of its scope, such as markup of a page that navigation is still reading. A marker
    // holds the place, and the children render there once both are ready, where they were
    // inserted, so they read the contexts there.
    const marker = `C${(nextChildren += 1)}`;
    const fill = (tries: number): void => {
      const node = findMarker(marker);
      if (!node) {
        return;
      }
      if (!this.from) {
        if (tries > 0) {
          setTimeout(() => fill(tries - 1), 0);
        }
        return;
      }
      insertHTML(node, super.render(at));
      node.remove();
    };
    void this.load().then(() => fill(100));
    return `<!--${marker}-->`;
  }

  get loaded(): boolean {
    return this.code !== undefined;
  }

  load(): Promise<void> {
    this.loading ??= resolve(this.ref, 'template').then((handler) => {
      this.code = handler;
    });
    return this.loading;
  }
}

/** The count of the markers of children that wait for their code. */
let nextChildren = 0;

/** The comment of a marker, such as of children that wait for their code. */
function findMarker(data: string): Comment | undefined {
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if ((node as Comment).data === data) {
      return node as Comment;
    }
  }
  return undefined;
}

/**
 * Loads the code of the children that the scope, or a component around it, holds, so code that
 * runs in the scope can insert them at once. Undefined when there is nothing to load.
 */
function childrenReady(scope: Scope | undefined): Promise<unknown> | undefined {
  const waiting: Promise<void>[] = [];
  const seen = new Set<Scope>();
  for (let current = scope; current && !seen.has(current); current = current.p ?? current.o) {
    seen.add(current);
    for (const value of current.s) {
      if (value instanceof RenderedChildren && !value.loaded) {
        waiting.push(value.load());
      }
    }
  }
  return waiting.length > 0 ? Promise.allSettled(waiting) : undefined;
}

/** The children of a component that the client renders. See `Children`. */
export function children(from: Scope | ScopeId | undefined, html: () => string): Children {
  return new Children(from, html);
}

/** A component's client render function, from its `?brumate-render` module. */
// oxlint-disable-next-line typescript/no-explicit-any -- Components take any props.
export type Component<P = any> = (props: P) => string;

function resolveScope(scope: Scope | ScopeId | undefined): Scope | undefined {
  if (typeof scope === 'object') {
    return scope;
  }
  return scope === undefined ? undefined : scopes.get(scope);
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
  inner: Raw | Children | undefined,
  _ctx?: unknown,
  scope?: Scope | number,
): string {
  if (typeof tag === 'function') {
    return component(
      tag as Component,
      inner ? { ...attributes, children: inner } : attributes,
      undefined,
      scope,
    );
  }
  const name = String(tag);
  const open = `<${name}${spreadText(attributes)}>`;
  return VOID_ELEMENTS.has(name)
    ? open
    : `${open}${inner ? insert(inner, undefined, scope) : ''}</${name}>`;
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
  rendered.push(created);
  // A component that the browser renders loads its code, as the components of the page do.
  if (module !== undefined) {
    loadComponent(module);
  }
  if (module !== undefined && owner) {
    created.o = owner;
    (owner.owned ??= new Set()).add(created);
    owner = undefined;
  }
  // A scope at the top of children that are inserted elsewhere finds its contexts there.
  const up = created.o ?? parentScope;
  for (let index = insertedChildren.length - 1; index >= 0; index--) {
    if (insertedChildren[index]!.from === up) {
      created.t = insertedChildren[index]!.at;
      break;
    }
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
  for (let slot = 0; slot < values.length; slot++) {
    const value = values[slot];
    if (isThenable(value)) {
      renderedLoads.add(`${id}:${slot}`);
      Promise.resolve(value).catch(noop);
    }
  }
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
export function handlerProp(
  value: unknown,
  ref: string,
  scope: Scope | number,
  bound: unknown[] = [],
  modifiers?: string[],
): unknown {
  // A template renders at once, and the client has its code already.
  if (typeof value !== 'function' || isTemplate(ref)) {
    return value;
  }
  const instance = resolveScope(scope);
  const handler = (...args: unknown[]): unknown => call(ref, instance, [...bound, ...args]);
  // A spread of markup that the browser renders passes it on, with the modifiers of its wrappers.
  // A scope that is not in the page yet has its ID in `scope`.
  handlerReferences.set(
    handler,
    new FunctionReference(
      ref,
      instance?.id ?? (scope as ScopeId),
      bound.length > 0 ? bound : undefined,
      modifiers ?? (value as { [MODIFIERS]?: string[] })[MODIFIERS],
    ),
  );
  return handler;
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
