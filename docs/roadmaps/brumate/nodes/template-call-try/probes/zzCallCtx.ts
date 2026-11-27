import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export const CallCtx: Context<{ shown: unknown } | undefined> = createContext<
  { shown: unknown } | undefined
>('call-ctx');
