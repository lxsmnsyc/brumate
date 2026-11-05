import { createContext } from 'brumate/context';
import type { Store } from 'brumate/store';

export interface Field {
  state: Store<{ count: number }>;
}

export const FieldCtx = createContext<Field>('field');
export const Level = createContext<Store<number>>('level');
