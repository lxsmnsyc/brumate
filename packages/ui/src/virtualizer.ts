// What a Virtualizer gives the collections in it: the height of a row, so they render only the
// rows in view. See `window` of `#for`.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

export interface VirtualizerState {
  rowHeight: number;
}

export const VirtualizerContext: Context<VirtualizerState | null> =
  createContext<VirtualizerState | null>('brumate-ui:virtualizer', null);
