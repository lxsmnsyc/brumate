import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { store } from 'brumate/store';
import type { Store } from 'brumate/store';

/** What a select gives its parts that never change. Null when a part is used on its own. */
export interface SelectState {
  labelId: string;
  toggle: () => void;
  choose: (value: string) => void;
}

export const SelectContext: Context<SelectState | null> = createContext<SelectState | null>(
  'spike-select',
  null,
);

/** Whether the select is open, in a store. Null when a part is used on its own. */
export const SelectOpenContext: Context<Store<boolean | null>> = createContext<
  Store<boolean | null>
>('spike-select-open', store(null));

/** The chosen value, in a store. */
export const SelectValueContext: Context<Store<string | null>> = createContext<
  Store<string | null>
>('spike-select-value', store(null));
