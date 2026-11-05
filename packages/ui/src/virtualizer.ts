// What a Virtualizer gives the collections in it: the height of a row, so they render only the
// rows in view. See `window` of `#for`.
import { createContext } from 'brumate/context';
import { store } from 'brumate/store';
import type { Context } from 'brumate/context';
import type { StoreLike } from 'brumate/store';

export interface VirtualizerState {
  rowHeight: number;
}

export const VirtualizerContext: Context<StoreLike<VirtualizerState | null>> = createContext<
  StoreLike<VirtualizerState | null>
>('brumate-ui:virtualizer', store(null));
