import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Store } from 'brumate/store';

export const Theme: Context<string> = createContext('theme');

/** The theme in a store, for a provider that changes it. */
export const ThemeStore: Context<Store<string>> = createContext<Store<string>>('theme-store');
