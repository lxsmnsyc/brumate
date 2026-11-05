import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { store } from 'brumate/store';
import type { Store } from 'brumate/store';

/** A provider store of a number. */
export const Level: Context<Store<number>> = createContext<Store<number>>('store-level', store(0));

/** A context with a handler and a store, as the parts hold a field. */
export const Field: Context<{ state: Store<{ count: number }>; bump: () => void }> = createContext(
  'store-field',
  { state: store({ count: 0 }), bump: () => {} },
);

/** A theme for the whole app: a module-level store as the default value. */
// The browser can start from another value than the server, such as a saved choice.
export const theme: Store<string> = store(
  (globalThis as { savedTheme?: string }).savedTheme ?? 'light',
);
export const Theme: Context<Store<string>> = createContext<Store<string>>('store-theme', theme);

/** A picker whose store writes the signal of its provider. */
export const Picker: Context<Store<string>> = createContext<Store<string>>(
  'store-picker',
  store(''),
);
