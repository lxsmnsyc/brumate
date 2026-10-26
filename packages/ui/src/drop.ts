// The items of a drop, after the DropItem of React Aria: text or a file, from a drag or a paste.

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

/** What a drop operation does, as React Aria names it. `cancel` refuses the drop. */
export type DropOperation = 'copy' | 'move' | 'link' | 'cancel';

export interface DropEvent {
  type: 'drop';
  items: DropItem[];
  x: number;
  y: number;
  dropOperation: DropOperation;
}

/** The items of a DataTransfer of a drag or a paste: one text item with its types, and the files. */
export function dropItems(data: DataTransfer): DropItem[] {
  const items: DropItem[] = [];
  const types = new Set([...data.types].filter((type) => type !== 'Files'));
  if (types.size > 0) {
    // The text is read now, while the DataTransfer can still be read.
    const texts = new Map([...types].map((type) => [type, data.getData(type)]));
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
    if (type !== 'Files') {
      types.add(type);
    }
  }
  return types;
}

/** Where a drop between the rows of a collection goes: before or after the row of `key`. */
export interface DropTarget {
  key: import('./collection.ts').Key;
  dropPosition: 'before' | 'after';
}

/** The rows that a drag in a collection moves, and where they go, as onReorder of React Aria. */
export interface ReorderEvent {
  keys: import('./collection.ts').Key[];
  target: DropTarget;
}

/** The data of a dragged row, as a string in each of its types, such as `text/plain`. */
export type DragItem = Record<string, string>;

/** The type that marks a drag of rows, whose value is the ID of the collection. */
export const ROWS_TYPE = 'application/x-brumate-rows';

/**
 * Puts the items of a drag in its DataTransfer. A DataTransfer holds one value of each type, so
 * the values of the items of a type are joined with new lines.
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
}
