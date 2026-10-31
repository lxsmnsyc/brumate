import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
type Total = { add: (n: number) => void; read: () => number };
export const PcTotal: Context<Total | undefined> = createContext<Total | undefined>('pctotal', undefined);
