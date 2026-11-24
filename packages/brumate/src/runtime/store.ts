// Stores: values that change, which a context can hold while the context itself stays the same.
// `$toStore` makes the store of a provider, and `$store` reads one in a component. The page state
// sends only the value of a store; the browser makes a new store for it.

import type { Context } from './context.ts';
import { HAS_BRIDGES } from './features.ts';

/** The pass of the core, which the browser sets, so a store's readers update in one pass. */
const PASS = Symbol.for('brumate.pass');

/** True for a context, which `createContext` made. */
export function isContext(value: unknown): value is Context<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string' &&
    Object.keys(value).length === 1 &&
    !isContract(value)
  );
}

/**
 * The store that `$store` reads: `value` is the store, or for `path` an object that holds it there.
 * `key` names the context that gave `value`, for the message. Throws a `TypeError` for a value that
 * is no store, such as `undefined` or a context, and for `write` on a store that has no `set`.
 */
export function findStored(
  value: unknown,
  path: string | undefined,
  write: boolean | undefined,
  key?: string,
): StoreLike<unknown> {
  const found = path === undefined ? value : (value as Record<string, unknown> | undefined)?.[path];
  if (!isContract(found)) {
    // A context is the most likely mistake, so its message names the read that gives its store.
    if (isContext(found)) {
      throw new TypeError(
        `$store reads the context "${found.key}", which is no store. Read the store in it with $store($getContext(Context))`,
      );
    }
    throw new TypeError(
      `$store reads ${key === undefined ? 'a value' : `the context "${key}"`}${path === undefined ? '' : ` at "${path}"`}, which gives no store: a store has the functions get and subscribe`,
    );
  }
  if (write && !canSet(found)) {
    throw new TypeError(
      `let $store(${key ?? '…'}) writes the store, but the store has no set. Read it with const`,
    );
  }
  return found;
}

/**
 * The error of `$store` for a store of another library in a value that the page sends, such as a
 * prop: only the value of a store of `brumate/store` crosses. The fix is said here only.
 */
export function sentForeignStore(component: string, value: string): Error {
  return new Error(
    `$store in ${component} reads a store of another library from ${value}, which the page sends, and only a store of brumate/store crosses. Wrap the library's store with bridge() in a module, or read it from an import, <script module> or a call in this component`,
  );
}

/** Where `$toStore` made a store: its scope, the ID of its site, and the slot of its signal. */
export type StoreOrigin = [scope: number | string, site: number, slot?: number];

/**
 * The contract of a store, which `$store` reads: `get`, `subscribe` (which returns the function
 * that stops it, and does not call the listener at once) and, for a two-way binding, `set`.
 */
export interface StoreLike<T> {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
  set?(value: T): void;
}

/** A value that changes, with the functions that read it and write it. */
export class Store<T> implements StoreLike<T> {
  /** The value. */
  v: T;
  /** The functions that `subscribe` added. */
  l: Set<(value: T) => void> = new Set();
  /** For a store of `$toStore(signal)`, the write of the signal, which the browser sets. */
  w?: (value: T) => void;
  /** True for a store of `$toStore(memo)`, which only its provider writes. */
  r?: boolean;
  /** Where `$toStore` made it, for the page state. */
  o?: StoreOrigin;
  /** True for a store of `$toStore` in the browser until its first update. */
  f?: boolean;
  /**
   * The mark of a store, which `isStore` reads in every copy of the runtime. A field, so a build
   * without stores drops the class.
   */
  k = 'brumate.store' as const;

  constructor(value: T) {
    this.v = value;
  }

  /** The current value. */
  get(): T {
    return this.v;
  }

  /** Calls `listener` with each new value. Returns the function that stops it. */
  subscribe(listener: (value: T) => void): () => void {
    this.l.add(listener);
    return () => {
      this.l.delete(listener);
    };
  }

  /**
   * Writes the value, and calls the listeners when it changed. A store of `$toStore(signal)`
   * writes the signal, and a store of a memo throws.
   */
  set(value: T): void {
    if (this.r) {
      throw new Error('This store follows a memo, so only its provider writes it');
    }
    if (Object.is(this.v, value)) {
      return;
    }
    if (this.w) {
      this.v = value;
      this.w(value);
      return;
    }
    sendStore(this, value);
  }
}

/** True for a store of `brumate/store`, of any copy of the runtime. */
export function isStore(value: unknown): value is Store<unknown> {
  return (
    typeof value === 'object' && value !== null && (value as { k?: unknown }).k === 'brumate.store'
  );
}

/** True for a value with the functions `get` and `subscribe` of the store contract. */
export function isContract(value: unknown): value is StoreLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { get?: unknown }).get === 'function' &&
    typeof (value as { subscribe?: unknown }).subscribe === 'function'
  );
}

/** True for a value of the store contract that is not a store of brumate. */
export function isForeignStore(value: unknown): boolean {
  return isContract(value) && !isStore(value) && !(HAS_BRIDGES && isBridged(value));
}

/** True when `$store` can write the store: it has `set`, and is not the store of a memo. */
export function canSet(value: StoreLike<unknown>): boolean {
  return typeof value.set === 'function' && !(value as Store<unknown>).r;
}

/** Makes a store, such as one that a module holds for the whole app. */
export function store<T>(value: T): Store<T> {
  return new Store(value);
}

/** Writes the value of a store and calls its listeners, in one pass of the page. */
export function sendStore<T>(target: Store<T>, value: T, force?: boolean): void {
  // The listeners hear of a change only. A provider's update forces it, since a `set` of
  // `$toStore(signal)` wrote the value before the signal's update came.
  if (!force && Object.is(target.v, value)) {
    return;
  }
  target.v = value;
  const listeners = () => {
    for (const listener of target.l) {
      listener(value);
    }
  };
  const pass = (globalThis as { [key: symbol]: (<R>(run: () => R) => R) | undefined })[PASS];
  if (pass) {
    pass(listeners);
  } else {
    listeners();
  }
}

// Derived stores: a read-only store that computes its value from other stores, with the API of
// Svelte 4's `derived`.

/** The stores that `derived` reads: one store, or an array of them. */
export type Stores = StoreLike<any> | [StoreLike<any>, ...StoreLike<any>[]] | StoreLike<any>[];

/** The values of `Stores`: a value for one store, an array of values for an array. */
export type StoresValues<S> =
  S extends StoreLike<infer U>
    ? U
    : { [K in keyof S]: S[K] extends StoreLike<infer U> ? U : never };

/** The derived stores that heard of a change and wait to compute. */
const waiting: Computed[] = [];
/** The listener sets that have a trailing listener, which computes the waiting stores. */
const armed = new Set<Set<unknown>>();
/** True while the waiting stores compute. */
let flushing = false;

/** Computes the waiting derived stores, the ones that read the fewest derived stores first. */
function flushComputed(): void {
  flushing = true;
  try {
    while (waiting.length > 0) {
      let next = 0;
      for (let i = 1; i < waiting.length; i++) {
        if (waiting[i]!.level < waiting[next]!.level) {
          next = i;
        }
      }
      const [computed] = waiting.splice(next, 1);
      computed!.waits = false;
      computed!.run();
    }
  } catch (error) {
    // The stores that still wait would never hear a source again, so they leave the queue.
    for (const computed of waiting) {
      computed.waits = false;
    }
    waiting.length = 0;
    throw error;
  } finally {
    flushing = false;
  }
}

/** The state of a derived store while it has subscribers. */
interface Computed {
  /** The number of derived stores below it, so a store computes after the ones it reads. */
  level: number;
  /** True while it waits in the queue. */
  waits: boolean;
  run(): void;
}

/**
 * Queues a derived store that a source told of a change. The store waits until the source has
 * called all its listeners, so a store that reads this one and the source computes once, after
 * this one.
 */
function enqueue(state: Computed, source: StoreLike<unknown>): void {
  if (state.waits) {
    return;
  }
  state.waits = true;
  waiting.push(state);
  if (flushing) {
    return;
  }
  const listeners = (source as Partial<Store<unknown>>).l;
  if (!listeners || armed.has(listeners)) {
    if (!listeners) {
      // A store of another library has no listeners to wait behind.
      flushComputed();
    }
    return;
  }
  // A listener added now runs after the ones of the source, in the same send.
  const trail = (): void => {
    listeners.delete(trail);
    armed.delete(listeners);
    flushComputed();
  };
  armed.add(listeners);
  listeners.add(trail as never);
}

/**
 * A store computed from `sources`. With a function of one parameter, the result is the value. With
 * two or three, the function calls `set` or `update`, and a function it returns runs before the
 * next call and when the last subscriber leaves. It follows its sources only while it has
 * subscribers; `get` computes from the sources otherwise. A source change that reaches it in one
 * pass computes it once, after the stores it reads.
 */
export function derived<S extends Stores, T>(
  sources: S,
  fn: (
    values: StoresValues<S>,
    set: (value: T) => void,
    update: (change: (value: T) => T) => void,
  ) => (() => void) | void,
  initial?: T,
): StoreLike<T>;
export function derived<S extends Stores, T>(
  sources: S,
  fn: (values: StoresValues<S>) => T,
  initial?: T,
): StoreLike<T>;
export function derived<T>(
  sources: Stores,
  fn: (
    values: unknown,
    set: (value: T) => void,
    update: (change: (value: T) => T) => void,
  ) => unknown,
  initial?: T,
): StoreLike<T> {
  const single = !Array.isArray(sources);
  const list: StoreLike<unknown>[] = single ? [sources] : sources;
  for (const source of list) {
    if (!source) {
      throw new Error('derived() expects stores as input, got a falsy value');
    }
  }
  const auto = fn.length < 2;
  const out = new Store<T>(initial as T);
  const subscribers = new Set<() => void>();
  let level = 1;
  // Present only when a source can be pending.
  const pend: Pendable = {};
  for (const source of list) {
    level = Math.max(level, ((source as { d?: number }).d ?? 0) + 1);
    if (pendingOf(source)) {
      pend.q = new Set();
    }
  }

  // The state of one run: `cleanup` is what `fn` returned, and `write` is where `set` goes.
  let cleanup: (() => void) | undefined;
  let started = false;
  let starting = false;
  let stops: (() => void)[] = [];

  /** Runs `fn` over the current values of the sources. */
  const compute = (write: (value: T) => void): void => {
    const values: unknown[] = [];
    for (const source of list) {
      values.push(source.get());
    }
    const set = write;
    const update = (change: (value: T) => T): void => write(change(out.v));
    cleanup?.();
    cleanup = undefined;
    const result = fn(single ? values[0] : values, set, update);
    if (auto) {
      write(result as T);
    } else if (typeof result === 'function') {
      cleanup = result as () => void;
    }
  };

  // The value is written without a notice while the first subscriber starts it, since nobody
  // listens yet and `subscribe` does not call the listener.
  const send = (value: T): void => {
    if (starting) {
      out.v = value;
    } else if (started) {
      sendStore(out, value);
    } else {
      // A late `set` after the last subscriber left keeps its value, as Svelte's store does.
      out.v = value;
    }
  };

  const state: Computed = {
    level,
    waits: false,
    run() {
      if (started) {
        compute(send);
      }
    },
  };

  /** Called by a source. */
  const heard = (source: StoreLike<unknown>): void => {
    if (started) {
      enqueue(state, source);
    }
  };

  const start = (): void => {
    starting = true;
    started = true;
    try {
      compute(send);
      for (const source of list) {
        stops.push(source.subscribe(() => heard(source)));
      }
      // A store that reads a pending store is pending while it is.
      if (pend.q) {
        const check = (): void => {
          let pending = false;
          for (const source of list) {
            pending ||= !!pendingOf(source)?.n;
          }
          setPending(pend, pending);
        };
        for (const source of list) {
          const q = pendingOf(source)?.q;
          if (q) {
            q.add(check);
            stops.push(() => q.delete(check));
          }
        }
        check();
      }
    } catch (error) {
      // A store that failed to start has no subscriptions, so it can start again.
      started = false;
      for (const end of stops) {
        end();
      }
      stops = [];
      cleanup?.();
      cleanup = undefined;
      throw error;
    } finally {
      starting = false;
    }
  };

  const stop = (): void => {
    started = false;
    for (const end of stops) {
      end();
    }
    stops = [];
    cleanup?.();
    cleanup = undefined;
    if (state.waits) {
      state.waits = false;
      waiting.splice(waiting.indexOf(state), 1);
    }
  };

  const result = Object.assign(
    {
      get(): T {
        if (started) {
          return out.v;
        }
        // No subscriber: compute once from the sources and stop. The async form keeps the
        // initial value until `set` runs.
        let value = out.v;
        started = true;
        try {
          compute((next) => {
            value = next;
          });
        } finally {
          started = false;
          cleanup?.();
          cleanup = undefined;
        }
        return value;
      },
      subscribe(listener: (value: T) => void): () => void {
        const stopListening = out.subscribe(listener);
        if (!started) {
          try {
            start();
          } catch (error) {
            stopListening();
            throw error;
          }
        }
        subscribers.add(stopListening);
        return () => {
          if (subscribers.delete(stopListening)) {
            stopListening();
            if (subscribers.size === 0) {
              stop();
            }
          }
        };
      },
    },
    { d: level },
  );
  if (pend.q) {
    Object.defineProperty(result, PENDING, { value: pend });
  }
  return result;
}

/** The key of a store that holds the error of a run, which `$store` reads again on each notice. */
export const HOLDS: unique symbol = Symbol.for('brumate.holds') as never;

/**
 * The key of the pending state of a store, which a store of a module can hold, as a memo that
 * loads is pending. `$isPending` and `$resolve` read it in a component.
 */
export const PENDING: unique symbol = Symbol.for('brumate.pending') as never;

/** The pending state: `n` is true while the store waits, and `q` holds the functions that hear of it. */
export interface Pendable {
  n?: boolean;
  q?: Set<(pending: boolean) => void>;
}

/** The pending state of a store, when it has one. */
export function pendingOf(store: unknown): Pendable | undefined {
  const state = (store as { [PENDING]?: Pendable } | null)?.[PENDING];
  return state?.q instanceof Set ? state : undefined;
}

/** Sets the pending flag of a store, and tells its listeners when it changed. */
function setPending(target: Pendable, pending: boolean): void {
  if (!!target.n !== pending) {
    target.n = pending;
    for (const listener of target.q!) {
      listener(pending);
    }
  }
}

/** True on the server, or in a test while server code runs. */
export function onServer(): boolean {
  const inRequest = (globalThis as Record<symbol, (() => boolean) | undefined>)[
    Symbol.for('brumate.inRequest')
  ];
  return typeof document === 'undefined' || inRequest?.() === true;
}

// The forms of a module: `$memo`, `$gate`, `$debounced` and `$throttled` at the top level of a
// module compile to `memoStore`. Its value can load, as the value of a memo of a component can: a
// promise, or an async iterable whose values it takes in turn. One load serves every reader of the
// process. The compiler calls it, so it has no docs of its own.

/** Thrown by a read of a memo of a module whose first value still loads. It carries the load. */
export class Waiting extends Error {
  /** The load, which settles when the memo has its value or its error. */
  readonly load: Promise<unknown>;

  constructor(load: Promise<unknown>) {
    super(
      'This value is still loading. Wait for it with await $resolve(memo), or check $isPending(memo) first',
    );
    this.load = load;
  }
}

/** The store that a component that imports a memo of a module reads with `$store`. */
export interface MemoFace extends StoreLike<unknown> {
  /** The value that the server rendered, which the browser takes on resume. */
  s(value: unknown): void;
  [HOLDS]: true;
}

/** The options of the forms other than `$memo`. */
export interface MemoOptions<T> {
  /** `$gate`: keeps the value while a subscriber holds the store and this returns false. */
  g?: (prev: T, next: T) => boolean;
  /** `$debounced` and `$throttled`: the wait in milliseconds, in the browser. */
  m?: number;
  /** `$throttled`: at most one value per wait, in place of the value after the last change. */
  t?: boolean;
  /** The names of the sources, which the page state sends for a value that loaded. */
  n?: string[];
}

/** The store of a memo of a module. */
export interface MemoStore<T> extends StoreLike<T> {
  /**
   * The store that a component that imports the memo reads with `$store`. On the server it gives
   * the value, or a promise of it when the value loads, which the page state sends. In the browser
   * it takes that value on resume, and sends on each change, so the memo of the importer computes
   * again.
   */
  i: MemoFace;
  /** The value, or a promise of it while the memo loads. Throws the error of the memo. */
  p(): unknown;
  /** Follows the sources without computing, for a memo that reads this one. */
  f(listener: (value: T) => void): () => void;
  /** An object that changes with each value or error; brought up to date first, unless `raw`. */
  t(raw?: boolean): object;
  /** True when the value loads, or a memo that it reads loads. */
  a(): boolean;
  /** The values of the sources by name, through the memos that it reads, without computing. */
  r(): Record<string, unknown>;
  /** The listeners of the value, so a store that reads this one computes after them. */
  l: Set<(value: T) => void>;
  /** The number of derived stores below it. */
  d: number;
  [PENDING]: Pendable;
  [HOLDS]: true;
}

/** True for a store that `memoStore` made. */
function isMemoStore(value: unknown): value is MemoStore<unknown> {
  return (
    typeof (value as { p?: unknown }).p === 'function' &&
    isContract((value as MemoStore<unknown>).i)
  );
}

/** True for a promise or an async iterable, which a memo loads. */
function loads(value: unknown): value is PromiseLike<unknown> | AsyncIterable<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    (typeof (value as { then?: unknown }).then === 'function' ||
      typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function')
  );
}

/** The value of a store, or the error that its `get` throws. */
function peekStore(source: StoreLike<unknown>): unknown {
  try {
    return source.get();
  } catch (error) {
    return error;
  }
}

/** True for what the server sends for a value that loaded: its promise and its sources. */
function isLoadedFace(value: unknown): value is [Promise<unknown>, Record<string, unknown>] {
  return Array.isArray(value) && value.length === 2 && value[0] instanceof Promise;
}

/** The render of the server that runs now, so a failed load is shared within it only. */
function currentRender(): object | undefined {
  return (globalThis as Record<symbol, object | undefined>)[Symbol.for('brumate.render')];
}

/**
 * The store of `$memo(expr)` at the top level of a module, and of `$gate`, `$debounced` and
 * `$throttled` with `options`. It computes when it is read, and again when a source changes: while
 * it has subscribers, at once, and otherwise at the next read, which compares the sources. A
 * promise or an async iterable loads: a read gives the last value, and `p` the load, and only the
 * latest run is written. A throw or a rejection is held until the memo computes again; on the
 * server only for the renders that read that run. A memo that reads one with no value yet waits for
 * it.
 */
export function memoStore<S extends Stores, T>(
  sources: S,
  fn: (values: StoresValues<S>) => T | PromiseLike<T> | AsyncIterable<T>,
  options?: MemoOptions<T>,
): MemoStore<T> {
  const single = !Array.isArray(sources);
  const list: StoreLike<unknown>[] = single ? [sources as StoreLike<unknown>] : sources;
  let level = 1;
  for (const source of list) {
    level = Math.max(level, ((source as { d?: number }).d ?? 0) + 1);
  }
  /** The value, which the listeners of the module hear. */
  const out = new Store<T>(undefined as T);
  /** What the memos of importers follow: the value, or an object that is new for each change. */
  const face = new Store<unknown>(undefined);
  const pend: Pendable = { q: new Set() };
  /** True when the latest run loaded, or waited for a memo that loads. */
  let loaded = false;
  /** On the server: the renders that read the latest run, which share its error. */
  let readers: Set<object> | undefined;
  /** On the server: the error of a run that failed, for each render that read it. */
  const failed = new WeakMap<object, { error: unknown }>();
  /** In the browser: the slot of an importer holds no value, so its memo computes again once. */
  let fresh = false;
  /** On the server: the promise of a value that loaded, which the page state sends. */
  let sent: Promise<T> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** When the last throttled value was taken. */
  let last = -Infinity;
  let has = false;
  let held: { error: unknown } | undefined;
  /** Changes with each value or error. */
  let token = {};
  /** What the sources were at the last run: their values, or the tokens of memos. */
  let seen: unknown[] | undefined;
  /** The number of the latest run, so a load that a newer run replaced is dropped. */
  let run = 0;
  /** The run whose own load is out, or 0. */
  let loading = 0;
  /** While the memo loads: the promise that its readers wait for. */
  let wait:
    | { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
    | undefined;
  let stopStream: (() => void) | undefined;
  /** The subscribers of the value and of the sources. */
  let count = 0;
  let stops: (() => void)[] = [];

  /** What the sources are now: a memo gives its token, brought up to date unless `raw`. */
  const marks = (raw?: boolean): unknown[] => {
    const values: unknown[] = [];
    for (const source of list) {
      values.push(isMemoStore(source) ? source.t(raw) : peekStore(source));
    }
    return values;
  };

  const changed = (raw?: boolean): boolean => {
    if (!seen) {
      return true;
    }
    const now = marks(raw);
    for (const [index, value] of now.entries()) {
      if (!Object.is(value, seen[index])) {
        return true;
      }
    }
    return false;
  };

  /** True while a source loads, such as a debounced value that waits. */
  const sourcesPending = (): boolean => {
    for (const source of list) {
      if (pendingOf(source)?.n) {
        return true;
      }
    }
    return false;
  };

  /** What a component that imports the memo reads now. In the browser it is new for a load. */
  const show = (): unknown => {
    if (held) {
      throw held.error;
    }
    if (fresh) {
      fresh = false;
      return {};
    }
    return wait ? face.v : out.v;
  };

  /** The values of the sources by name, through the memos that it reads, without computing. */
  const record = (): Record<string, unknown> => {
    const values: Record<string, unknown> = {};
    for (const [index, source] of list.entries()) {
      values[options?.n?.[index] ?? String(index)] = isMemoStore(source)
        ? source.r()
        : peekStore(source);
    }
    return values;
  };

  /**
   * The memos of importers compute again. The reader of the slot reads `show` again, as for any
   * store that holds an error, so what goes out is a notice only.
   */
  const bump = (): void => {
    if (wait) {
      face.v = {};
    }
    if (face.l.size > 0) {
      sendStore(face, face.v, true);
    }
  };

  /** The memo loads: its readers get a promise, and it is pending. */
  const enter = (): void => {
    if (wait) {
      return;
    }
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    // A rejection that no reader waits for is held, not reported.
    promise.catch(() => {});
    wait = { promise, resolve, reject };
    setPending(pend, true);
    bump();
  };

  /** The load ends: the readers that wait get the value or the error. */
  const release = (): void => {
    if (!wait || loading !== 0 || sourcesPending()) {
      return;
    }
    if (!has && !held) {
      compute();
      return;
    }
    const done = wait;
    wait = undefined;
    setPending(pend, false);
    if (held) {
      done.reject(held.error);
    } else {
      done.resolve(out.v);
    }
  };

  /** Writes the value or the error of a run, unless a newer run replaced it. */
  const finish = (id: number, value: T | undefined, failure?: { error: unknown }): void => {
    if (id !== run) {
      return;
    }
    loading = 0;
    const had = held;
    const before = out.v;
    const first = !has;
    held = failure;
    sent = undefined;
    // The renders that read this run keep its error for the rest of their render.
    if (failure) {
      for (const render of readers ?? []) {
        failed.set(render, failure);
      }
    }
    if (!failure) {
      has = true;
      out.v = value as T;
    }
    // The readers hear of an error, and of the end of one, even with the same value. A value that
    // did not change, such as one that a gate kept, runs no reader.
    const news = !!failure || !!had || first || !Object.is(before, out.v);
    if (news) {
      token = {};
    }
    if (wait) {
      release();
    } else if (news) {
      bump();
    }
    if (news) {
      sendStore(out, out.v, true);
    }
  };

  /** Reads a stream: each value is the value, and the first one ends the load. */
  const read = (id: number, stream: AsyncIterable<T>, server: boolean): void => {
    const iterator = stream[Symbol.asyncIterator]();
    stopStream = () => {
      void iterator.return?.();
    };
    const step = (): void => {
      iterator.next().then(
        (result) => {
          if (id !== run) {
            return;
          }
          if (result.done) {
            stopStream = undefined;
            if (loading === id) {
              finish(id, undefined);
            }
            return;
          }
          finish(id, result.value);
          // The server renders the first value, as for a memo of a component.
          if (server) {
            stopStream?.();
            stopStream = undefined;
            return;
          }
          step();
        },
        (error: unknown) => finish(id, undefined, { error }),
      );
    };
    step();
  };

  /** Runs the function over the values of the sources, for the run `id`. */
  const evaluate = (id: number): void => {
    let result: unknown;
    loaded = false;
    try {
      seen = marks();
      const values: unknown[] = [];
      for (const source of list) {
        values.push(source.get());
      }
      result = fn((single ? values[0] : values) as StoresValues<S>);
    } catch (error) {
      if (error instanceof Waiting) {
        // A memo that it reads has no value yet: this one waits, and computes when it settles.
        loaded = true;
        loading = id;
        enter();
        const again = (): void => {
          if (id === run) {
            loading = 0;
            evaluate(id);
          }
        };
        error.load.then(again, again);
        return;
      }
      finish(id, undefined, { error });
      return;
    }
    const guard = options?.g;
    if (guard) {
      if (loads(result)) {
        finish(id, undefined, {
          error: new TypeError(
            'The value of $gate is a promise or a stream. Use $memo for a value that loads',
          ),
        });
        return;
      }
      // A gate keeps no history without a subscriber, and the first value after an error passes.
      if (count > 0 && has && !held) {
        try {
          if (!guard(out.v, result as T)) {
            result = out.v;
          }
        } catch (error) {
          finish(id, undefined, { error });
          return;
        }
      }
    }
    if (!loads(result)) {
      finish(id, result as T);
      return;
    }
    loaded = true;
    loading = id;
    enter();
    const server = onServer();
    Promise.resolve(result).then(
      (value) => {
        if (id !== run) {
          return;
        }
        if (loads(value)) {
          read(id, value as AsyncIterable<T>, server);
        } else {
          finish(id, value as T);
        }
      },
      (error: unknown) => finish(id, undefined, { error }),
    );
  };

  /** Fires the wait of a debounced or throttled value: the latest run takes the value. */
  const fire = (): void => {
    timer = undefined;
    last = Date.now();
    loading = 0;
    evaluate(run);
  };

  /**
   * Starts a run. A debounced or throttled value that a subscriber holds in the browser waits:
   * it takes the value after `m` once the sources stop changing, or at most once every `m`.
   */
  const compute = (): void => {
    const id = ++run;
    stopStream?.();
    stopStream = undefined;
    loading = 0;
    readers = undefined;
    const ms = options?.m;
    if (ms === undefined || count === 0 || onServer()) {
      evaluate(id);
      return;
    }
    const since = Date.now() - last;
    if (options!.t && timer === undefined && since >= ms) {
      last = Date.now();
      evaluate(id);
      return;
    }
    if (!options!.t) {
      clearTimeout(timer);
      timer = undefined;
    }
    loading = id;
    enter();
    timer ??= setTimeout(fire, options!.t ? ms - since : ms);
  };

  /**
   * Computes when the memo has no value, or, with no subscriber, when a source changed. With
   * `retry`, on the server, a held error is read again only by the renders that read its run: a
   * later render loads again.
   */
  const ensure = (retry?: boolean): void => {
    if (!has && !held && !wait) {
      compute();
    } else if (count === 0 && changed()) {
      compute();
    } else if (retry && held && !wait) {
      const render = currentRender();
      if (render && !failed.has(render)) {
        compute();
      }
    }
  };

  /**
   * Notes the render of the server that reads the latest run. Returns the error that the render
   * read before, which it keeps, though a later render loaded again.
   */
  const note = (): { error: unknown } | undefined => {
    const render = currentRender();
    if (!render) {
      return undefined;
    }
    const kept = failed.get(render);
    if (!kept) {
      (readers ??= new Set()).add(render);
    }
    return kept;
  };

  const state: Computed = {
    level,
    waits: false,
    run() {
      if (count > 0 && changed()) {
        compute();
      }
    },
  };

  /** A subscriber starts to follow the sources; the last one to leave stops it. */
  const follow = (): (() => void) => {
    if (count++ === 0) {
      for (const source of list) {
        const heard = (): void => enqueue(state, source);
        stops.push(isMemoStore(source) ? source.f(heard) : source.subscribe(heard));
        const q = pendingOf(source)?.q;
        if (q) {
          const check = (): void => {
            if (sourcesPending()) {
              enter();
            } else {
              release();
            }
          };
          q.add(check);
          stops.push(() => q.delete(check));
        }
      }
      if (sourcesPending()) {
        enter();
      }
      // A source that changed while nothing followed computes it again. A memo that never ran,
      // such as one that the browser took from the server, waits for a change.
      // The memos that it reads checked their own sources as it followed them, so their tokens
      // are up to date.
      if (seen && changed(true)) {
        compute();
      }
    }
    let done = false;
    return () => {
      if (!done) {
        done = true;
        if (--count === 0) {
          for (const end of stops) {
            end();
          }
          stops = [];
          // A wait that nothing follows ends: the value is the value, as without a subscriber.
          if (timer !== undefined) {
            clearTimeout(timer);
            fire();
          }
        }
      }
    };
  };

  /** A subscription of `target`, which also follows the sources. */
  const listen = <V>(target: Store<V>, listener: (value: V) => void): (() => void) => {
    const off = target.subscribe(listener);
    const unfollow = follow();
    return () => {
      off();
      unfollow();
    };
  };

  const memo: MemoStore<T> = {
    get(): T {
      ensure();
      if (held) {
        throw held.error;
      }
      if (has) {
        return out.v;
      }
      throw new Waiting(wait!.promise);
    },
    subscribe(listener: (value: T) => void): () => void {
      // The value is there before the listener, which hears of changes only.
      ensure();
      return listen(out, listener);
    },
    p(): unknown {
      ensure(true);
      const kept = note();
      if (kept) {
        throw kept.error;
      }
      if (wait) {
        return wait.promise;
      }
      if (held) {
        throw held.error;
      }
      return out.v;
    },
    f(listener: (value: T) => void): () => void {
      return listen(out, listener);
    },
    t(raw?: boolean): object {
      if (!raw) {
        ensure();
      }
      return token;
    },
    a(): boolean {
      if (loaded) {
        return true;
      }
      for (const source of list) {
        if (isMemoStore(source) && source.a()) {
          return true;
        }
      }
      return false;
    },
    r: record,
    i: {
      get(): unknown {
        // The browser subscribes the slot before it reads it. The server only reads.
        if (count > 0) {
          return show();
        }
        // A value that loaded goes as a promise with the values of its sources, so the browser
        // takes it without computing while its own sources are the same. A value that computes at
        // once goes as a marker, since the memo of the importer sends it, and the browser computes
        // it again; an object goes as it is, which the page state sends once for both.
        ensure(true);
        if (note() || (held && !wait)) {
          return undefined;
        }
        if (!wait && !memo.a()) {
          return typeof out.v === 'object' && out.v !== null ? out.v : 0;
        }
        // The memo of the importer sends the error itself, so this one is generic. A promise in an
        // array stays a promise in the browser, which puts the value of a promise slot in its place.
        const promise = (wait ? wait.promise : (sent ??= Promise.resolve(out.v))).catch(() => {
          throw new Error('The page could not compute a value');
        });
        return [promise, record()];
      },
      subscribe(listener: (value: unknown) => void): () => void {
        return listen(face, listener);
      },
      s(value: unknown): void {
        // Only a memo that has not run takes the value of the server.
        if (has || held || wait || seen || value === undefined) {
          return;
        }
        if (!isLoadedFace(value)) {
          // It computed at once on the server, so it does here, and a value that differs, such as
          // one of other sources, is written to the page. A marker in the slot makes the memo of
          // the importer compute again, as nothing compares with it.
          compute();
          fresh = typeof value !== 'object' || value === null;
          return;
        }
        // A value that loaded of other sources than the browser's, such as a signal that a server
        // function wrote on the server, loads again here, and the old value stays meanwhile.
        const [promise, serverSources] = value;
        if (!sameData(serverSources, record())) {
          compute();
          return;
        }
        // The same sources: the browser takes the value, and loads again when a source changes.
        const id = ++run;
        loaded = true;
        loading = id;
        enter();
        face.v = value;
        seen = marks(true);
        promise.then(
          (settled) => finish(id, settled as T),
          (error: unknown) => finish(id, undefined, { error }),
        );
      },
      // `$store` reads it again on each notice, and a read that throws puts the error in the slot.
      [HOLDS]: true,
    },
    l: out.l,
    d: level,
    [PENDING]: pend,
    [HOLDS]: true,
  };
  return memo;
}

// Bridges: a store of another library that can cross the page state. `bridge()` names how to make
// the library's store, read it and listen to it, and the page state sends the data that `get`
// reads, with the name of the bridge. The browser makes the library's store again, once, from
// that data.

/** What `bridge` takes. */
export interface BridgeOptions<S, T> {
  /**
   * Makes the library's store. On the server it runs once for each call of the bridge. In the
   * browser it runs once, when the store gets its first subscriber, with the data that the server
   * sent. It must be in a module that the browser can load.
   */
  create: (snapshot: T | undefined) => S;
  /** The data of the store: plain data that the page state can send. */
  get: (source: S) => T;
  /** Calls `listener` when the store changes. Returns the function that stops it. */
  subscribe: (source: S, listener: () => void) => () => void;
  /** Writes the store. The browser never calls it when the page resumes. */
  set?: (source: S, value: T) => void;
}

/** A store of `bridge()`: the contract of a store, and the store of the library. */
export interface BridgedStore<S, T> extends StoreLike<T> {
  /**
   * The store of the library. In the browser it is undefined until the store has a subscriber,
   * since the browser makes it at the first subscriber.
   */
  readonly source: S | undefined;
}

/** What `bridge` returns: makes a store, from the data of the server in the browser. */
export interface Bridge<S, T> {
  (snapshot?: T): BridgedStore<S, T>;
  /** The options. */
  b: BridgeOptions<S, T>;
  /** The name that the compiler gave, `bridge:<file>#<export>`. */
  i?: string;
}

const BRIDGES = Symbol.for('brumate.bridges');
const BRIDGE_LOAD = Symbol.for('brumate.bridge-load');

type Global = { [BRIDGES]?: Map<string, Bridge<never, never>>; [BRIDGE_LOAD]?: Loader };
type Loader = [load: (module: string) => Promise<unknown>, report: (error: unknown) => void];

/** The bridges by name, which any copy of the runtime shares. */
function bridges(): Map<string, Bridge<never, never>> {
  return ((globalThis as Global)[BRIDGES] ??= new Map());
}

/**
 * Sets how the browser loads the module of a bridge, and where a failed load is reported. The
 * core calls it when it starts.
 */
export function setBridgeLoader(...loader: Loader): void {
  (globalThis as Global)[BRIDGE_LOAD] = loader;
}

/** The module of a bridge, from its name. */
function bridgeModule(id: string): string {
  return id.slice(0, id.lastIndexOf('#'));
}

/**
 * Makes a bridge. Keep its value in a module-level export, so the page state can name it:
 * `export const bears = bridge({ … })`. The compiler gives it its name.
 */
export function bridge<S, T>(options: BridgeOptions<S, T>): Bridge<S, T> {
  const made = Object.assign(
    (snapshot?: T): BridgedStore<S, T> => new Bridged(made, options.create(snapshot)),
    { b: options },
  ) as Bridge<S, T>;
  return made;
}

/** Gives a bridge its name, which the compiler writes at the end of its module. */
export function nameBridge(made: Bridge<never, never>, id: string): void {
  made.i = id;
  bridges().set(id, made);
}

/** True for a store of `bridge()`, of any copy of the runtime. */
export function isBridged(value: unknown): value is Bridged<unknown, unknown> {
  return (
    typeof value === 'object' && value !== null && (value as { k?: unknown }).k === 'brumate.bridge'
  );
}

/**
 * Whether two values hold the same data: the same value, or arrays and plain objects whose items
 * hold the same data. A store that the browser makes again holds a new object with the content
 * the server sent, which needs no repair.
 */
export function sameData(a: unknown, b: unknown, open?: Map<object, Set<unknown>>): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  const array = Array.isArray(a);
  if (array ? !Array.isArray(b) || a.length !== b.length : !isPlain(a) || !isPlain(b)) {
    return false;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  // A pair already under compare is a cycle: it counts as the same, so each pair is compared once.
  open ??= new Map();
  let pairs = open.get(left);
  if (pairs?.has(right)) {
    return true;
  }
  if (!pairs) {
    pairs = new Set();
    open.set(left, pairs);
  }
  pairs.add(right);
  const keys = Object.keys(left);
  if (!array && keys.length !== Object.keys(right).length) {
    return false;
  }
  for (const key of keys) {
    if (!(key in right) || !sameData(left[key], right[key], open)) {
      return false;
    }
  }
  return true;
}

/** Whether a value is an object of `Object` or of no prototype, as page state holds. */
function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * The store that a bridge makes. On the server it holds the library's store from the start. In
 * the browser the page state makes it with the name of the bridge and the data of the server, and
 * it makes the library's store at its first subscriber.
 */
export class Bridged<S, T> implements BridgedStore<S, T> {
  /** The mark of a bridged store, which `isBridged` reads in every copy of the runtime. */
  k = 'brumate.bridge' as const;
  /** The bridge. Undefined for a store of the page state until the module of the bridge loads. */
  f?: Bridge<S, T>;
  /** The name of the bridge, for a store of the page state. */
  i?: string;
  /** The library's store. */
  s?: S;
  /** True once the library's store exists. */
  m = false;
  /** The data that the server sent, until the library's store exists. */
  v?: T;
  /** Whether the bridge has `set`, as the server sent it, until the module loads. */
  w?: boolean;

  constructor(
    made: Bridge<S, T> | undefined,
    source: S | undefined,
    id?: string,
    snapshot?: T,
    writable?: boolean,
  ) {
    this.f = made;
    this.i = id;
    this.v = snapshot;
    this.w = writable;
    if (made) {
      this.s = source;
      this.m = true;
    }
  }

  /**
   * The library's store. In the browser it is undefined until the store has a subscriber and the
   * module of the bridge has loaded.
   */
  get source(): S | undefined {
    return this.s;
  }

  /** The name of the bridge. */
  get id(): string | undefined {
    return this.f?.i ?? this.i;
  }

  /** The data of the store: what `get` reads, or what the server sent before the first subscriber. */
  get(): T {
    return this.m ? this.f!.b.get(this.s as S) : (this.v as T);
  }

  /**
   * Calls `listener` with the data when it changes. The first subscriber makes the library's
   * store in the browser. When the module of the bridge has not loaded, the subscription starts
   * when it has.
   */
  subscribe(listener: (value: T) => void, ...seen: [value?: T]): () => void {
    let stopped = false;
    let stop: (() => void) | undefined;
    // What this subscriber has seen, which `seen` can name: a source that starts later compares
    // with it.
    let last = seen.length > 0 ? (seen[0] as T) : this.get();
    const start = (): void => {
      if (stopped) {
        return;
      }
      const options = this.f!.b;
      const source = this.make();
      stop = options.subscribe(source, () => {
        const next = options.get(source);
        if (!sameData(next, last)) {
          last = next;
          listener(next);
        }
      });
      // A source that starts from other data than this subscriber saw, such as one that keeps its
      // own state, is written once.
      const first = options.get(source);
      if (!sameData(first, last)) {
        last = first;
        listener(first);
      }
    };
    if (this.find()) {
      start();
    } else {
      void this.load().then((loaded) => loaded && start());
    }
    return () => {
      stopped = true;
      stop?.();
    };
  }

  /** Writes the library's store, when the bridge has `set`. */
  get set(): ((value: T) => void) | undefined {
    // Before the module loads, the server's word is all there is, so `let` checks the same.
    const writable = this.find() ? !!this.f!.b.set : this.w !== false;
    return writable ? (value) => this.write(value) : undefined;
  }

  /** Writes the library's store, after the module of the bridge has loaded. */
  private write(value: T): void {
    if (this.find()) {
      this.f!.b.set!(this.make(), value);
    } else {
      void this.load().then((loaded) => loaded && this.write(value));
    }
  }

  /** The bridge, once its module has loaded. */
  private find(): Bridge<S, T> | undefined {
    if (!this.f && this.i !== undefined) {
      this.f = bridges().get(this.i) as Bridge<S, T> | undefined;
    }
    return this.f;
  }

  /** Loads the module of the bridge. A failure goes to the core's error path; it gives false. */
  private load(): Promise<boolean> {
    const [load, report] = (globalThis as Global)[BRIDGE_LOAD] ?? [];
    return Promise.resolve(load?.(bridgeModule(this.i!))).then(
      () => {
        if (this.find()) {
          return true;
        }
        this.fail(
          report,
          new Error(
            `The bridge "${this.i}" is not in its module. Keep bridge() in a module-level export, as "export const name = bridge({ … })"`,
          ),
        );
        return false;
      },
      (error: unknown) => {
        this.fail(report, error);
        return false;
      },
    );
  }

  private fail(report: ((error: unknown) => void) | undefined, error: unknown): void {
    if (report) {
      report(error);
    } else {
      console.error(error);
    }
  }

  /** Makes the library's store once, with the data of the server. */
  private make(): S {
    if (!this.m) {
      this.s = this.f!.b.create(this.v);
      this.m = true;
    }
    return this.s as S;
  }
}
