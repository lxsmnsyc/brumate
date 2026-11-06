import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Store } from 'brumate/store';

/** What a select gives its parts that never change. A part on its own throws, since no select provides it. */
export interface SelectState {
  labelId: string;
  toggle: () => void;
  choose: (value: string) => void;
}

export const SelectContext: Context<SelectState | null> = createContext<SelectState | null>(
  'spike-select',
);

/** Whether the select is open, in a store. A part on its own throws, since no select provides it. */
export const SelectOpenContext: Context<Store<boolean | null>> =
  createContext<Store<boolean | null>>('spike-select-open');

/** The chosen value, in a store. */
export const SelectValueContext: Context<Store<string | null>> =
  createContext<Store<string | null>>('spike-select-value');
