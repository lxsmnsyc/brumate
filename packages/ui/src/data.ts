// The changes of the list and tree data of `data.brm.ts`. Each takes the items and gives new ones, so a signal that holds them updates.
import type { Key } from './collection.ts';

/** The key of an item: its `id`, or else its `key`. */
export function defaultKey(item: unknown): Key {
  const value = item as { id?: Key; key?: Key };
  return (value.id ?? value.key)!;
}

/** The items with values put in at an index. */
export function insertAt<T>(items: readonly T[], index: number, values: readonly T[]): T[] {
  const at = Math.max(0, Math.min(index, items.length));
  return [...items.slice(0, at), ...values, ...items.slice(at)];
}

/** The items without those with the keys. */
export function removeKeys<T>(
  items: readonly T[],
  keys: readonly Key[],
  keyOf: (item: T) => Key,
): T[] {
  return items.filter((item) => !keys.includes(keyOf(item)));
}

/**
 * The items with those of the keys moved together, in their order, to sit before or after the
 * item with `target`.
 */
export function moveKeys<T>(
  items: readonly T[],
  target: Key,
  keys: readonly Key[],
  after: boolean,
  keyOf: (item: T) => Key,
): T[] {
  if (keys.includes(target)) {
    return [...items];
  }
  const moved = items.filter((item) => keys.includes(keyOf(item)));
  const rest = items.filter((item) => !keys.includes(keyOf(item)));
  const at = rest.findIndex((item) => keyOf(item) === target);
  if (at === -1) {
    return [...items];
  }
  return insertAt(rest, after ? at + 1 : at, moved);
}

/** A node of tree data: an item, its key, the key of the node that holds it, and its children. */
export interface TreeDataNode<T> {
  id: Key;
  parentKey: Key | null;
  value: T;
  /** The nodes inside it, or null for an item that has no children. */
  children: TreeDataNode<T>[] | null;
}

/** The nodes of items, each with its key and the key of its parent. */
export function buildNodes<T>(
  items: readonly T[],
  parentKey: Key | null,
  keyOf: (item: T) => Key,
  childrenOf: (item: T) => readonly T[] | null | undefined,
): TreeDataNode<T>[] {
  return items.map((value) => {
    const id = keyOf(value);
    const children = childrenOf(value);
    return {
      id,
      parentKey,
      value,
      children: children ? buildNodes(children, id, keyOf, childrenOf) : null,
    };
  });
}

/** The node with a key, anywhere in the tree. */
export function findNode<T>(
  nodes: readonly TreeDataNode<T>[],
  key: Key,
): TreeDataNode<T> | undefined {
  for (const node of nodes) {
    if (node.id === key) {
      return node;
    }
    const found = node.children && findNode(node.children, key);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * The tree with the children of the node with `parentKey` changed, or the top nodes for null.
 * The nodes on the way to it are new, and the others stay as they were.
 */
export function changeChildren<T>(
  nodes: readonly TreeDataNode<T>[],
  parentKey: Key | null,
  change: (children: TreeDataNode<T>[]) => TreeDataNode<T>[],
): TreeDataNode<T>[] {
  if (parentKey === null) {
    return change([...nodes]);
  }
  return nodes.map((node) => {
    if (node.id === parentKey) {
      return { ...node, children: change([...(node.children ?? [])]) };
    }
    return node.children
      ? { ...node, children: changeChildren(node.children, parentKey, change) }
      : node;
  });
}

/** The tree without the nodes of the keys, and their children. */
export function removeNodes<T>(
  nodes: readonly TreeDataNode<T>[],
  keys: readonly Key[],
): TreeDataNode<T>[] {
  return nodes
    .filter((node) => !keys.includes(node.id))
    .map((node) =>
      node.children ? { ...node, children: removeNodes(node.children, keys) } : node,
    );
}

/** The node and the keys of the nodes inside it. */
export function keysWithin<T>(node: TreeDataNode<T>): Key[] {
  return [node.id, ...(node.children ?? []).flatMap((child) => keysWithin(child))];
}
