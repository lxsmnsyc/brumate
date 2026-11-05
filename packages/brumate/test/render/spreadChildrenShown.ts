import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { store } from 'brumate/store';
import type { Store } from 'brumate/store';

/** Whether spreadChildrenPick shows its children, in a store. */
export const Shown: Context<Store<boolean>> = createContext<Store<boolean>>(
  'spread-children-shown',
  store(false),
);
