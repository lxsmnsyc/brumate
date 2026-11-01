import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
type Total = { add: (n: number) => void; read: () => number };
export const ReaderTotal: Context<Total | undefined> = createContext<Total | undefined>(
  'readertotal',
  undefined,
);
