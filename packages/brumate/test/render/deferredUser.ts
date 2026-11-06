import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export const DeferredUser: Context<string | undefined> = createContext<string | undefined>(
  'deferreduser',
);
