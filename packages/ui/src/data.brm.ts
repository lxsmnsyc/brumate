// List and tree data, after useListData and useTreeData of React Stately: items in a signal, with
// the changes that apps make to them, and a selection, for the collection parts.
import { $memo, $signal } from 'brumate/signals';
import type { Key } from './collection.ts';
import {
  buildNodes,
  changeChildren,
  defaultKey,
  findNode,
  insertAt,
  keysWithin,
  moveKeys,
  removeKeys,
  removeNodes,
} from './data.ts';
import type { TreeDataNode } from './data.ts';

// The options are values that the page state holds. A function cannot go in the state, so the
// functions come as arguments of their own, which the compiler writes into the code.

export interface ListDataOptions<T> {
  initialItems?: readonly T[];
  initialSelectedKeys?: readonly Key[];
  initialFilterText?: string;
}

/**
 * Items of a list that an app changes, as useListData of React Stately. `items` are those that
 * the filter keeps, and the changes take keys and values.
 *
 * - `getKey` gives the key of an item. Its `id`, or else its `key`, by default.
 * - `filter` says whether an item shows for the text of the filter. All show without it.
 */
export function listData<T>(
  options: ListDataOptions<T>,
  getKey?: (item: T) => Key,
  filter?: (item: T, filterText: string) => boolean,
) {
  let all = $signal<T[]>([...(options.initialItems ?? [])]);
  let selectedKeys = $signal<Key[]>([...(options.initialSelectedKeys ?? [])]);
  let filterText = $signal(options.initialFilterText ?? '');
  const items = $memo(filter ? all.filter((item) => filter(item, filterText)) : all);

  function keyOf(item: T): Key {
    return getKey ? getKey(item) : defaultKey(item);
  }

  function indexOf(key: Key): number {
    return all.findIndex((item) => keyOf(item) === key);
  }

  function getItem(key: Key): T | undefined {
    return all.find((item) => keyOf(item) === key);
  }

  function insert(index: number, ...values: T[]) {
    all = insertAt(all, index, values);
  }

  function insertBefore(key: Key, ...values: T[]) {
    const at = indexOf(key);
    if (at !== -1) {
      all = insertAt(all, at, values);
    }
  }

  function insertAfter(key: Key, ...values: T[]) {
    const at = indexOf(key);
    if (at !== -1) {
      all = insertAt(all, at + 1, values);
    }
  }

  function append(...values: T[]) {
    all = [...all, ...values];
  }

  function prepend(...values: T[]) {
    all = [...values, ...all];
  }

  function remove(...keys: Key[]) {
    all = removeKeys(all, keys, keyOf);
    // A removed item leaves the selection.
    selectedKeys = selectedKeys.filter((key) => !keys.includes(key));
  }

  function removeSelectedItems() {
    remove(...selectedKeys);
  }

  function move(key: Key, toIndex: number) {
    const at = indexOf(key);
    if (at === -1) {
      return;
    }
    const rest = all.filter((_, index) => index !== at);
    all = insertAt(rest, toIndex, [all[at]!]);
  }

  function moveBefore(key: Key, keys: Key[]) {
    all = moveKeys(all, key, keys, false, keyOf);
  }

  function moveAfter(key: Key, keys: Key[]) {
    all = moveKeys(all, key, keys, true, keyOf);
  }

  function update(key: Key, value: T) {
    all = all.map((item) => (keyOf(item) === key ? value : item));
  }

  function setSelectedKeys(keys: Key[]) {
    selectedKeys = keys;
  }

  function addKeysToSelection(keys: Key[]) {
    selectedKeys = [...selectedKeys, ...keys.filter((key) => !selectedKeys.includes(key))];
  }

  function removeKeysFromSelection(keys: Key[]) {
    selectedKeys = selectedKeys.filter((key) => !keys.includes(key));
  }

  function setFilterText(text: string) {
    filterText = text;
  }

  return {
    items,
    selectedKeys,
    filterText,
    getItem,
    insert,
    insertBefore,
    insertAfter,
    append,
    prepend,
    remove,
    removeSelectedItems,
    move,
    moveBefore,
    moveAfter,
    update,
    setSelectedKeys,
    addKeysToSelection,
    removeKeysFromSelection,
    setFilterText,
  };
}

export interface TreeDataOptions<T> {
  initialItems?: readonly T[];
  initialSelectedKeys?: readonly Key[];
}

/**
 * Items of a tree that an app changes, as useTreeData of React Stately. `items` are nodes with
 * an `id`, the key of their parent, their `value` and their `children`, which a Tree takes.
 *
 * - `getKey` gives the key of an item. Its `id`, or else its `key`, by default.
 * - `getChildren` gives the children of an item. Its `children` by default.
 */
export function treeData<T>(
  options: TreeDataOptions<T>,
  getKey?: (item: T) => Key,
  getChildren?: (item: T) => readonly T[] | null | undefined,
) {
  function keyOf(item: T): Key {
    return getKey ? getKey(item) : defaultKey(item);
  }

  function childrenOf(item: T): readonly T[] | null | undefined {
    return getChildren ? getChildren(item) : (item as { children?: readonly T[] | null }).children;
  }

  function nodesOf(values: readonly T[], parentKey: Key | null): TreeDataNode<T>[] {
    return buildNodes(values, parentKey, keyOf, childrenOf);
  }

  let items = $signal<TreeDataNode<T>[]>(nodesOf(options.initialItems ?? [], null));
  let selectedKeys = $signal<Key[]>([...(options.initialSelectedKeys ?? [])]);

  function getItem(key: Key): TreeDataNode<T> | undefined {
    return findNode(items, key);
  }

  function insert(parentKey: Key | null, index: number, ...values: T[]) {
    items = changeChildren(items, parentKey, (children) =>
      insertAt(children, index, nodesOf(values, parentKey)),
    );
  }

  function insertNear(key: Key, after: boolean, values: T[]) {
    const node = getItem(key);
    if (!node) {
      return;
    }
    items = changeChildren(items, node.parentKey, (children) => {
      const at = children.findIndex((child) => child.id === key);
      return insertAt(children, after ? at + 1 : at, nodesOf(values, node.parentKey));
    });
  }

  function insertBefore(key: Key, ...values: T[]) {
    insertNear(key, false, values);
  }

  function insertAfter(key: Key, ...values: T[]) {
    insertNear(key, true, values);
  }

  function append(parentKey: Key | null, ...values: T[]) {
    const parent = parentKey === null ? undefined : getItem(parentKey);
    insert(parentKey, parent ? (parent.children?.length ?? 0) : items.length, ...values);
  }

  function prepend(parentKey: Key | null, ...values: T[]) {
    insert(parentKey, 0, ...values);
  }

  function remove(...keys: Key[]) {
    // A removed node takes its children with it, and they leave the selection too.
    const gone = keys.flatMap((key) => {
      const node = getItem(key);
      return node ? keysWithin(node) : [];
    });
    items = removeNodes(items, keys);
    selectedKeys = selectedKeys.filter((key) => !gone.includes(key));
  }

  function removeSelectedItems() {
    remove(...selectedKeys);
  }

  function move(key: Key, toParentKey: Key | null, index: number) {
    const node = getItem(key);
    // A node cannot move into itself or a node inside it.
    if (!node || (toParentKey !== null && keysWithin(node).includes(toParentKey))) {
      return;
    }
    const moved = { ...node, parentKey: toParentKey };
    items = changeChildren(removeNodes(items, [key]), toParentKey, (children) =>
      insertAt(children, index, [moved]),
    );
  }

  function moveNear(target: Key, keys: Key[], after: boolean) {
    const node = getItem(target);
    if (!node || keys.includes(target)) {
      return;
    }
    const moved = keys
      // A key twice moves once, and a node inside a moved node moves with it.
      .filter(
        (key, at) =>
          keys.indexOf(key) === at &&
          !keys.some((other) => {
            const found = other === key ? undefined : getItem(other);
            return found !== undefined && keysWithin(found).includes(key);
          }),
      )
      .map((key) => getItem(key))
      .filter((found) => found !== undefined)
      // A node cannot move next to a node inside it.
      .filter((found) => !keysWithin(found).includes(target))
      .map((found) => ({ ...found, parentKey: node.parentKey }));
    const movedKeys = moved.map((found) => found.id);
    items = changeChildren(removeNodes(items, movedKeys), node.parentKey, (children) => {
      const at = children.findIndex((child) => child.id === target);
      return insertAt(children, after ? at + 1 : at, moved);
    });
  }

  function moveBefore(key: Key, keys: Key[]) {
    moveNear(key, keys, false);
  }

  function moveAfter(key: Key, keys: Key[]) {
    moveNear(key, keys, true);
  }

  function update(key: Key, value: T) {
    const node = getItem(key);
    if (!node) {
      return;
    }
    const [replaced] = nodesOf([value], node.parentKey);
    items = changeChildren(items, node.parentKey, (children) =>
      children.map((child) => (child.id === key ? replaced! : child)),
    );
  }

  function setSelectedKeys(keys: Key[]) {
    selectedKeys = keys;
  }

  return {
    items,
    selectedKeys,
    getItem,
    insert,
    insertBefore,
    insertAfter,
    append,
    prepend,
    remove,
    removeSelectedItems,
    move,
    moveBefore,
    moveAfter,
    update,
    setSelectedKeys,
  };
}
