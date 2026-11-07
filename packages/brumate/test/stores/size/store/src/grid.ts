import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Store } from 'brumate/store';

export interface GridState {
  selected: number;
  focused: number;
}

export interface GridValue {
  state: Store<GridState>;
  select: (day: number) => void;
}

export const Grid: Context<GridValue> = createContext<GridValue>('grid');
