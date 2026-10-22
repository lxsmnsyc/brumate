import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** What a select gives its parts. Null when a part is used on its own. */
export interface SelectState {
  open: boolean;
  value: string | null;
  labelId: string;
  toggle: () => void;
  choose: (value: string) => void;
}

export const SelectContext: Context<SelectState | null> = createContext<SelectState | null>(
  'spike-select',
  null,
);
