// The rows of a Tree: the items that show, in order, with their place in the tree.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { StoreLike } from 'brumate/store';
import type { Key } from './collection.ts';

/** An item of a Tree. `children` makes it a parent, even when it is empty. */
export interface TreeNode {
  id: Key;
  children?: readonly TreeNode[] | null;
}

/** A row of a Tree: an item that shows, with its place in the tree. */
export interface TreeRow<T extends TreeNode = TreeNode> {
  item: T;
  key: Key;
  /** The place among all the rows that show, from 1. */
  index: number;
  /** The depth, from 1 for an item at the top. */
  level: number;
  /** The place among its siblings, from 1. */
  position: number;
  /** How many siblings it has, itself too. */
  size: number;
  /** The key of the item that holds it. */
  parent?: Key;
  hasChildItems: boolean;
  isExpanded: boolean;
}

/**
 * The rows that show: each item, then the rows of its children while it is expanded, as React
 * Aria flattens a tree. The children of a collapsed item do not render.
 */
export function visibleRows<T extends TreeNode>(
  items: readonly T[],
  expandedKeys: readonly Key[],
): TreeRow<T>[] {
  const rows: TreeRow<T>[] = [];
  function add(list: readonly T[], level: number, parent: Key | undefined): void {
    for (const [index, item] of list.entries()) {
      const children = item.children as readonly T[] | null | undefined;
      const hasChildItems = Array.isArray(children);
      const isExpanded = hasChildItems && expandedKeys.includes(item.id);
      rows.push({
        item,
        key: item.id,
        index: rows.length + 1,
        level,
        position: index + 1,
        size: list.length,
        parent,
        hasChildItems,
        isExpanded,
      });
      if (isExpanded) {
        add(children!, level + 1, item.id);
      }
    }
  }
  add(items, 1, undefined);
  return rows;
}

/** What a Tree gives each row: its place in the tree. */
export interface TreeRowState {
  row: TreeRow;
}

export const TreeRowContext: Context<StoreLike<TreeRowState | null>> =
  createContext<StoreLike<TreeRowState | null>>('brumate-ui:tree-row');

/** What a Tree gives its rows. It changes, so it is in a store. */
export interface TreeState {
  /** The rows render only while in view, so each says its place among all of them. */
  windowed: boolean;
}

/** What a Tree gives: the store of its state, and how to open and close a row. */
export interface TreeGiven {
  state: StoreLike<TreeState | null>;
  toggle?: (key: Key) => void;
}

export const TreeContext: Context<TreeGiven> = createContext<TreeGiven>('brumate-ui:tree');
