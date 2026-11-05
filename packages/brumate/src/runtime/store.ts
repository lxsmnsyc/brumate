// Stores: values that change, which a context can hold while the context itself stays the same.
// `$toStore` makes the store of a provider, and `$store` reads one in a component. The page state
// sends only the value of a store; the browser makes a new store for it.

/** The pass of the core, which the browser sets, so a store's readers update in one pass. */
const PASS = Symbol.for('brumate.pass');

/** Where `$toStore` made a store: its scope, the ID of its site, and the slot of its signal. */
export type StoreOrigin = [scope: number | string, site: number, slot?: number];

/** A value that changes, with the functions that read it and write it. */
export class Store<T> {
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

  /** Writes the value. A store of `$toStore(signal)` writes the signal, and a store of a memo throws. */
  set(value: T): void {
    if (this.r) {
      throw new Error('This store follows a memo, so only its provider writes it');
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

/** True for a value with a `subscribe` function that is not a store of brumate. */
export function isForeignStore(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { subscribe?: unknown }).subscribe === 'function' &&
    !isStore(value)
  );
}

/** Makes a store, such as one that a module holds for the whole app. */
export function store<T>(value: T): Store<T> {
  return new Store(value);
}

/** Writes the value of a store and calls its listeners, in one pass of the page. */
export function sendStore<T>(target: Store<T>, value: T): void {
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
