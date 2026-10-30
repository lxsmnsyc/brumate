// The items of a drop: text or a file, from a drag or a paste.
import type { Key } from './collection.ts';

/** Text that a drop gives, in each of its types, such as `text/plain` and `text/html`. */
export interface TextDropItem {
  kind: 'text';
  types: Set<string>;
  getText: (type: string) => Promise<string>;
}

/** A file that a drop gives. */
export interface FileDropItem {
  kind: 'file';
  type: string;
  name: string;
  getFile: () => Promise<File>;
  getText: () => Promise<string>;
}

export type DropItem = TextDropItem | FileDropItem;

/** What a drop operation does. `cancel` refuses the drop. */
export type DropOperation = 'copy' | 'move' | 'link' | 'cancel';

export interface DropEvent {
  type: 'drop';
  items: DropItem[];
  x: number;
  y: number;
  dropOperation: DropOperation;
}

/** The types that a drag adds for itself: they are not data, so a drop does not see them. */
function isInternal(type: string): boolean {
  return type === 'Files' || type === ROWS_TYPE || type === ITEMS_TYPE;
}

/** The items that a drag of `setDragData` put in its DataTransfer, or undefined for another drag. */
function dragItems(data: DataTransfer): DragItem[] | undefined {
  try {
    const parsed: unknown = JSON.parse(data.getData(ITEMS_TYPE));
    return Array.isArray(parsed) ? (parsed as DragItem[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The items of a DataTransfer of a drag or a paste: a text item with its types for each item of a
 * drag of `setDragData`, else one for all the text, and the files.
 */
export function dropItems(data: DataTransfer): DropItem[] {
  const items: DropItem[] = [];
  const dragged = dragItems(data);
  const types = new Set<string>();
  for (const type of data.types) {
    if (!isInternal(type)) {
      types.add(type);
    }
  }
  if (dragged) {
    for (const item of dragged) {
      items.push({
        kind: 'text',
        types: new Set(Object.keys(item)),
        getText: (type) => Promise.resolve(item[type] ?? ''),
      });
    }
  } else if (types.size > 0) {
    // The text is read now, while the DataTransfer can still be read.
    const texts = new Map<string, string>();
    for (const type of types) {
      texts.set(type, data.getData(type));
    }
    items.push({
      kind: 'text',
      types,
      getText: (type) => Promise.resolve(texts.get(type) ?? ''),
    });
  }
  for (const file of data.files) {
    items.push({
      kind: 'file',
      type: file.type,
      name: file.name,
      getFile: () => Promise.resolve(file),
      getText: () => file.text(),
    });
  }
  return items;
}

/** The types of a drag, as a drop target sees them before the drop: files show as their kinds. */
export function dragTypes(data: DataTransfer): Set<string> {
  const types = new Set<string>();
  for (const item of data.items ?? []) {
    types.add(item.kind === 'file' ? item.type || 'application/octet-stream' : item.type);
  }
  for (const type of data.types) {
    types.add(type);
  }
  for (const type of types) {
    if (isInternal(type)) {
      types.delete(type);
    }
  }
  return types;
}

/** Where a drop between the rows of a collection goes: before or after the row of `key`. */
export interface DropTarget {
  key: Key;
  dropPosition: 'before' | 'after';
}

/** The rows that a drag in a collection moves, and where they go. */
export interface ReorderEvent {
  keys: Key[];
  target: DropTarget;
}

/** The data of a dragged row, as a string in each of its types, such as `text/plain`. */
export type DragItem = Record<string, string>;

/** The type that marks a drag of rows, whose value is the ID of the collection. */
export const ROWS_TYPE = 'application/x-brumate-rows';

/** The type that holds the items of a drag as JSON, one for each row, which a drop reads back. */
export const ITEMS_TYPE = 'application/x-brumate-items';

/**
 * Puts the items of a drag in its DataTransfer. A DataTransfer holds one value of each type, so
 * the values of the items of a type are joined with new lines, for drops that are not ours. A
 * drop of ours gets one item for each, from the JSON of `ITEMS_TYPE`.
 */
export function setDragData(data: DataTransfer, items: readonly DragItem[]): void {
  const types = new Map<string, string[]>();
  for (const item of items) {
    for (const [type, value] of Object.entries(item)) {
      types.set(type, [...(types.get(type) ?? []), value]);
    }
  }
  for (const [type, values] of types) {
    data.setData(type, values.join('\n'));
  }
  data.setData(ITEMS_TYPE, JSON.stringify(items));
}

/** The operations that the `effectAllowed` of a drag allows. A drag with none set allows all. */
export function allowedOperations(effectAllowed: string | undefined): DropOperation[] {
  const all: DropOperation[] = ['copy', 'move', 'link'];
  // A `DataTransfer` that code makes has `none`, and a real drag that allows nothing is refused
  // by the browser anyway, so `none` names no limit either.
  if (
    effectAllowed === undefined ||
    effectAllowed === 'all' ||
    effectAllowed === 'uninitialized' ||
    effectAllowed === 'none'
  ) {
    return all;
  }
  const allowed: DropOperation[] = [];
  for (const operation of all) {
    if (effectAllowed.toLowerCase().includes(operation)) {
      allowed.push(operation);
    }
  }
  return allowed;
}
