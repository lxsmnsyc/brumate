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
export function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let index = 0; index < a.length; index++) {
      if (!sameData(a[index], b[index])) {
        return false;
      }
    }
    return true;
  }
  if (!isPlain(a) || !isPlain(b)) {
    return false;
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of keys) {
    if (!(key in b) || !sameData(a[key], b[key])) {
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
