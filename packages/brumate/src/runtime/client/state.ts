// The types of the core and the state that its modules share: the options, the scopes, the loaded
// modules and parts, and the indexes of comments and elements. It imports no code of the core.

import type { NavigationReport } from '../navigate.ts';
import type { PageState, ScopeId } from '../shared.ts';
import type { SerialEntry } from '../values.ts';
import type { HiddenBody, Hiding } from './branches.ts';
import type { Component } from './components.ts';

type Update = [kind: number, name: string];

/** The entry of a compiled client module. */
export interface ClientModule {
  id: string;
  /** Prop names to slot indices. `*` is the slot of a props object. */
  props: Record<string, number>;
  /** Scope kind, then slot, to the updates that read it. */
  g: Record<number, Record<number, Update[]>>;
  /** The handlers that can write a slot of another component. The others write only their own. */
  w?: string[];
  /**
   * Imports a part of the module. A module without it holds every part
   * itself, as a small component's module does.
   */
  load?: (part: string) => Promise<Part>;
  /**
   * The render functions of components that this component sends as values, such as in a
   * prop. The state holds only their IDs, so `dynamic` finds them here.
   */
  components?: (Component & { brumateId: string })[];
  /** Server function ID to the memos that call it, as scope kind and update, for `refresh`. */
  refresh?: Record<string, Update[]>;
  /**
   * The `#try` blocks that catch errors of client code, by the scope kinds
   * inside their bodies: the kind of the scope that holds the block, the
   * anchor of the block, the render functions of the body and the `#catch`
   * body, and the kinds of both bodies, and the holder of a block in children.
   */
  t?: Record<
    number,
    [
      owner: number,
      anchor: number,
      body: string,
      fallback: string,
      kinds: number[],
      holderKind?: number,
      holderAnchor?: number,
    ]
  >;
}

/** A part of a client module: one client root, or the updates. */
export type Part = Record<string, unknown>;

/** The part that holds an export: `h<n>` and `c<n>` have their own, the rest are in `update`. */
export function partOf(name: string): string {
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
  /** For a component that passes its children on, the scope where they are finally inserted. */
  f?: Scope;
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
  /** The scopes inside it, made with the first one. */
  children?: Set<Scope>;
  /** The `b-root` of the render that the server rendered the scope in. */
  r?: string;
  cleanups?: Map<string, () => void>;
  keys?: Map<number, unknown>;
  /** Set while the scope is the body of an `#offscreen` block that is hidden. */
  h?: HiddenBody;
  /** Effects and `$client` callbacks to run when the `#offscreen` body around the scope shows. */
  w?: Set<string>;
  /**
   * The nodes that updates write, by anchor, of markup that the browser cloned: elements, and
   * the start comments of text inserts.
   */
  n?: Node[];
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

export let options: CoreOptions;

/** The URL prefix of server function calls, from the options. */
export let rpcPrefix = '/_brumate';

/** The ID of the build of the page, from the loader. Undefined on the dev server. */
export let build: string | undefined;

/** Sets the options of the page, with the prefix of server function calls and the build. */
export function configure(value: CoreOptions): void {
  options = value;
  rpcPrefix = value.rpc ?? '/_brumate';
  build = value.build;
}

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
  /**
   * Reads a bound element that a part owns, such as a `contenteditable`, when the core starts.
   * Returns `{ value }` when the user changed it since the server rendered it, `false` when
   * not, and nothing for an element of the core, which it reads itself.
   */
  field?: (element: Element) => { value: unknown } | false | undefined;
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
export const DEV: boolean | undefined = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export function devtools(): DevtoolsHooks | undefined {
  return (globalThis as Record<symbol, DevtoolsHooks | undefined>)[DEVTOOLS];
}

export const modules: Map<string, ClientModule> = new Map();

export const loading: Map<string, Promise<ClientModule>> = new Map();

export const valueRenders: Record<string, Component> = {};

export const parts: Map<string, Promise<Part>> = new Map();

export const loadedParts: Map<string, Part> = new Map();

export const comments: Map<string, Comment> = new Map();

export const elements: Map<string, Element> = new Map();

// Records of one render share references through an array, so a later record can settle a
// promise of an earlier one. Each render on the page has its own array, by its `b-root`.
export const refs: Map<string, unknown[]> = new Map();

// The latest load of each async memo, by `<scope>:<slot>`, so older results are dropped.
export const loads: Map<string, number> = new Map();

export const loadingSlots: Set<string> = new Set();

/** The timers of debounced and throttled memos, by `scope:slot`, with when each last computed. */
export const timers: Map<string, { timer?: ReturnType<typeof setTimeout>; last: number }> =
  new Map();

/** Aborts the server function calls of a memo's compute, by memo key. */
export const memoControllers: Map<string, AbortController> = new Map();

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
export let guesses: Guesses | undefined;

/** Sets the guesses, which the first `guess` makes. */
export function setGuesses(value: Guesses): Guesses {
  return (guesses = value);
}

/**
 * The code of hidden `#offscreen` bodies. The first body that hides sets it
 * up, so the core of a page without one only checks that it is not there.
 * A body is hidden with an inline `display: none !important` on each element
 * at its top level, which no stylesheet overrides, and empty text for each
 * text node. The nodes stay in the page, so form fields, focus and media
 * keep their state.
 */
export let hiding: Hiding | undefined;

/** Sets the code of hidden bodies, which the first body that hides makes, or drops it. */
export function setHiding(value: Hiding | undefined): Hiding | undefined {
  return (hiding = value);
}

/** Children that render where they are inserted, and the scopes that they find contexts from. */
export const insertedChildren: { from: Scope | undefined; at: Scope }[] = [];

/**
 * Slots that the render of a component in the browser filled with a promise,
 * by `scope:slot`. The first compute of their memo takes that promise
 * instead of calling again, so a server function is called once per row.
 */
export const renderedLoads: Set<string> = new Set();

/**
 * The promises that the page knows are values still loading: a memo that the server streams, and
 * a memo that the browser rendered. Any other promise in a slot is a plain value.
 */
export const loadingValues: WeakSet<object> = new WeakSet();

// More than 0 while code runs that updates the page. It reads a promise that is still loading as it
// is, and does not throw.
export let exempt: number = 0;

/** Runs code that updates the page: an update of a write, a refresh, or children that render late. */
export function updating<T>(run: () => T): T {
  exempt++;
  try {
    return run();
  } finally {
    exempt--;
  }
}
