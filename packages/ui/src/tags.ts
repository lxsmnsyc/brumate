// The state that a TagGroup shares with its TagList and its Tags.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Key, SelectionMode } from './collection.ts';

export interface TagGroupState {
  selectionMode: SelectionMode;
  selectedKeys: Key[];
  disabledKeys: Key[];
  /** Toggles a tag in the selection. */
  select: (key: Key) => void;
  /** True when the TagGroup has `onRemove`, so its tags can be removed. */
  canRemove: boolean;
  /** Removes tags. */
  remove: (keys: Key[]) => void;
  /** The ID of the Label, which names the list. */
  labelId: string;
  descriptionId: string;
}

export const TagGroupContext: Context<TagGroupState | null> = createContext<TagGroupState | null>(
  'brumate-ui:tag-group',
  null,
);
