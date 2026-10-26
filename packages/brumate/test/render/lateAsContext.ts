import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** A component that a part renders for its caller. */
export const LateAsContext: Context<{ as: any } | null> = createContext<{ as: any } | null>(
  'late-as',
  null,
);
