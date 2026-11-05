// The state that a TagGroup shares with its TagList and its Tags.
import { createContext } from 'brumate/context';
import { store } from 'brumate/store';
import type { Context } from 'brumate/context';
import type { StoreLike } from 'brumate/store';
import type { Key, SelectionMode } from './collection.ts';

export interface TagGroupState {
  selectionMode: SelectionMode;
  selectedKeys: Key[];
  disabledKeys: Key[];
  /** True when the TagGroup has `onRemove`, so its tags can be removed. */
  canRemove: boolean;
  /** The ID of the Label, which names the list. */
  labelId: string;
  /** The ID of the description, while there is one. */
  descriptionId?: string;
}

/** What a Tag calls on its group. */
export interface TagGroupHandlers {
  /** Toggles a tag in the selection. */
  select: (key: Key) => void;
  /** Removes tags. */
  remove: (keys: Key[]) => void;
}

/** What a TagGroup gives: the store of its state, and its handlers. Outside a group there is no handler. */
export interface TagGroupGiven extends Partial<TagGroupHandlers> {
  state: StoreLike<TagGroupState | null>;
}

export const TagGroupContext: Context<TagGroupGiven> = createContext<TagGroupGiven>(
  'brumate-ui:tag-group',
  { state: store(null) },
);
