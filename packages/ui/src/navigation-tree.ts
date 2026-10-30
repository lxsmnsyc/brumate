// The state that a NavigationTree gives its items: the route of the page, and the items that hold
// the item of that route.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Key } from './collection.ts';
import type { TreeNode } from './tree.ts';

/** An item of a NavigationTree, which links to `href`. */
export interface NavigationNode extends TreeNode {
  href?: string;
  children?: readonly NavigationNode[] | null;
}

export interface NavigationTreeState {
  selectedRoute: string | null;
  /** The keys of the items that hold the item of the route, outermost first. */
  ancestors: Key[];
}

export const NavigationTreeContext: Context<NavigationTreeState | null> =
  createContext<NavigationTreeState | null>('brumate-ui:navigation-tree', null);

/** What a NavigationTreeItem gives its link. */
export interface NavigationLinkState {
  href: string | undefined;
  isCurrent: boolean;
  /** The item is disabled, so its link does not navigate or take focus. */
  isDisabled: boolean;
}

export const NavigationLinkContext: Context<NavigationLinkState | null> =
  createContext<NavigationLinkState | null>('brumate-ui:navigation-link', null);

/** The keys of the items that hold the item whose `href` is the route, outermost first. */
export function ancestorsOf(items: readonly NavigationNode[], route: string | null): Key[] {
  if (route === null) {
    return [];
  }
  for (const item of items) {
    if (item.href === route) {
      return [];
    }
    const inside = item.children ? ancestorsOf(item.children, route) : [];
    let hasChild = false;
    for (const child of item.children ?? []) {
      if (child.href === route) {
        hasChild = true;
        break;
      }
    }
    if (inside.length > 0 || hasChild) {
      return [item.id, ...inside];
    }
  }
  return [];
}
