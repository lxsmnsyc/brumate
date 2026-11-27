import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Store } from 'brumate/store';

/** A store whose value holds the call of a `#template`. */
export const CallStore: Context<Store<unknown>> = createContext<Store<unknown>>('call-store');
