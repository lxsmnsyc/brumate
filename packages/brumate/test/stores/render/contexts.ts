import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { store } from 'brumate/store';
import type { Store, StoreLike } from 'brumate/store';

/** A provider store of a number. */
export const Level: Context<Store<number>> = createContext<Store<number>>('store-level');

/** A context with a handler and a store, as the parts hold a field. */
export const Field: Context<{ state: Store<{ count: number }>; bump: () => void }> =
  createContext('store-field');

/** A theme for the whole app: a module-level store. */
// The browser can start from another value than the server, such as a saved choice.
export const theme: Store<string> = store(
  (globalThis as { savedTheme?: string }).savedTheme ?? 'light',
);
/** A picker whose store writes the signal of its provider. */
export const Picker: Context<Store<string>> = createContext<Store<string>>('store-picker');

/** A store of another library: it has `get`, `subscribe` and `set`, and is not a `Store`. */
export function foreignStore<T>(value: T): StoreLike<T> {
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      value = next;
      for (const listener of listeners) {
        listener(next);
      }
    },
  };
}

/** A foreign store at module level. The browser can start from a saved value. */
export const foreignTheme: StoreLike<string> = foreignStore(
  (globalThis as { savedForeign?: string }).savedForeign ?? 'light',
);

/** A foreign store with only `get` and `subscribe`, which a test changes with `emit`. */
const readOnlyListeners = new Set<(value: number) => void>();
let readOnlyValue = (globalThis as { savedReadOnly?: number }).savedReadOnly ?? 1;
export const readOnly: StoreLike<number> & { emit(value: number): void } = {
  get: () => readOnlyValue,
  subscribe(listener) {
    readOnlyListeners.add(listener);
    return () => readOnlyListeners.delete(listener);
  },
  emit(value) {
    readOnlyValue = value;
    for (const listener of readOnlyListeners) {
      listener(value);
    }
  },
};

/** A context of handlers, which has a `subscribe` function and no store. */
export const Bus: Context<{ subscribe: () => void; publish: () => void }> =
  createContext('store-bus');
