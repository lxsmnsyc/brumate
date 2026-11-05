import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export interface GridValue {
  selected: number;
  focused: number;
  select: (day: number) => void;
}

export const Grid: Context<GridValue> = createContext<GridValue>('grid', {
  selected: 0,
  focused: 0,
  select: () => {},
});
