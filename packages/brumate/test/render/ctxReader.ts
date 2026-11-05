import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Store } from 'brumate/store';
type Total = { total: Store<number>; add: (n: number) => void };
export const ReaderTotal: Context<Total> = createContext<Total>('readertotal');
