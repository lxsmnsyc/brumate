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
  for (const source of list) {
    level = Math.max(level, ((source as { d?: number }).d ?? 0) + 1);
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

  /**
   * Called by a source. The store waits until the source has called all its listeners, so a store
   * that reads this one and the source computes once, after this one.
   */
  const heard = (source: StoreLike<unknown>): void => {
    if (!started || state.waits) {
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
  };

  const start = (): void => {
    starting = true;
    started = true;
    try {
      compute(send);
      for (const source of list) {
        stops.push(source.subscribe(() => heard(source)));
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

  return Object.assign(
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
