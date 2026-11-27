import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** A context whose value holds the call of a `#template`. */
export const CallContext: Context<{ shown: unknown } | undefined> = createContext<
  { shown: unknown } | undefined
>('call-context');
