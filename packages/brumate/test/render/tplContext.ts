import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Store } from 'brumate/store';

export const Level: Context<number> = createContext<number>('tpl-level');

/** The level as a store, for a provider that changes it. */
export const LevelStore: Context<Store<number>> = createContext<Store<number>>('tpl-level-store');
