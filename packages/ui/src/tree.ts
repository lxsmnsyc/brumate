// The rows of a Tree: the items that show, in order, with their place in the tree.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
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
  const add = (list: readonly T[], level: number, parent: Key | undefined): void => {
    list.forEach((item, index) => {
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
    });
  };
  add(items, 1, undefined);
  return rows;
}

/** What a Tree gives each row: its place in the tree. */
export interface TreeRowState {
  row: TreeRow;
}

export const TreeRowContext: Context<TreeRowState | null> = createContext<TreeRowState | null>(
  'brumate-ui:tree-row',
  null,
);

/** What a Tree gives its rows: how to open and close one, and whether it windows them. */
export interface TreeState {
  toggle: (key: Key) => void;
  /** The rows render only while in view, so each says its place among all of them. */
  windowed: boolean;
}

export const TreeContext: Context<TreeState | null> = createContext<TreeState | null>(
  'brumate-ui:tree',
  null,
);

/**
 * Attributes that a part around a TreeItem gives its row, such as a NavigationTreeItem. A context
 * passes them, not a spread on the TreeItem, so the TreeItem keeps its own props as they are.
 */
export const TreeItemAttributesContext: Context<Record<string, unknown> | null> =
  createContext<Record<string, unknown> | null>('brumate-ui:tree-item-attributes', null);
