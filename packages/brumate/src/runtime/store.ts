// Stores: values that change, which a context can hold while the context itself stays the same.
// `$toStore` makes the store of a provider, and `$store` reads one in a component. The page state
// sends only the value of a store; the browser makes a new store for it.

import type { Context } from './context.ts';

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
 * The store that `$store` reads in the value of its source: the source is a context, a store, or an
 * object that holds the store at `path`. `readContext` gives the value of a context. Throws for a
 * value that is no store, and for `write` on a store that has no `set`.
 */
export function findStored(
  source: unknown,
  path: string | undefined,
  write: boolean | undefined,
  readContext: (context: Context<unknown>) => unknown,
): StoreLike<unknown> {
  const context = isContext(source);
  const value = context ? readContext(source) : source;
  const found = path === undefined ? value : (value as Record<string, unknown> | undefined)?.[path];
  if (!isContract(found)) {
    throw new Error(
      `$store reads ${context ? `the context "${source.key}"` : 'a value'}${path === undefined ? '' : ` at "${path}"`}, which gives no store: a store has the functions get and subscribe`,
    );
  }
  if (write && !canSet(found)) {
    throw new TypeError(
      `let ${context ? `$store(${source.key})` : '$store(…)'} writes the store, but the store has no set. Read it with const`,
    );
  }
  return found;
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
  return isContract(value) && !isStore(value);
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
