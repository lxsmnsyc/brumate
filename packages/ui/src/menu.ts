// The state that a Menu shares with its trigger, its items and its submenus.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { Key, SelectionMode } from './collection.ts';

/** The roles of the items of a menu: an action, a radio and a checkbox. */
export const MENU_ITEMS = 'menuitem|menuitemradio|menuitemcheckbox';

/**
 * Where focus goes when a menu opens: its first item, its last item, or the menu itself, as
 * after a press with a pointer.
 */
export type FocusStrategy = 'first' | 'last' | 'none';

/** What a MenuTrigger or a SubmenuTrigger gives the Menu inside its Popover. */
export interface MenuTriggerState {
  /** The ID of the trigger, which names the menu. */
  triggerId: string;
  focusStrategy: FocusStrategy;
  /** Closes the menu and every menu that it opened from. */
  closeAll: () => void;
  /** True for a submenu, which ArrowLeft closes. */
  isSubmenu: boolean;
}

export const MenuTriggerContext: Context<MenuTriggerState | null> =
  createContext<MenuTriggerState | null>('brumate-ui:menu-trigger', null);

/** What a Menu gives its items. */
export interface MenuState {
  selectionMode: SelectionMode;
  selectedKeys: Key[];
  /** Closes this menu and every menu around it, after an action. */
  closeAll?: () => void;
  disabledKeys: Key[];
  /** The ID of the item of this menu that has focus, which a SubmenuTrigger closes for. */
  focusedId: string | undefined;
  /** Acts on an item: selects it, calls `onAction`, and closes the menu unless it stays open. */
  action: (key: Key) => void;
  /** With focus in a field around the menu, the item that its keys move to. */
  activeKey?: Key | null;
  /** With focus in a field around the menu, makes an item the active one. */
  setActive?: (key: Key) => void;
}

export const MenuContext: Context<MenuState | null> = createContext<MenuState | null>(
  'brumate-ui:menu',
  null,
);

/** What a SubmenuTrigger gives the MenuItem that opens it. */
export interface SubmenuState {
  /** The ID that the item takes, which the submenu is placed next to. */
  triggerId: string;
  overlayId: string;
  isOpen: boolean;
  /** Opens the submenu, and moves focus into it unless `focus` is false. */
  open: (strategy: FocusStrategy, focus: boolean) => void;
  /** The pointer is on the item: the submenu opens after a delay. */
  hoverStart: () => void;
  /** The pointer left the item before the delay. */
  hoverEnd: () => void;
}

export const SubmenuContext: Context<SubmenuState | null> = createContext<SubmenuState | null>(
  'brumate-ui:submenu',
  null,
);

/** The timer of the pointer that rests on a submenu item, by the ID of the item. */
const hoverTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Calls `open` after `delay`, unless the timer of the item stops first. */
export function startHoverTimer(id: string, delay: number, open: () => void): void {
  stopHoverTimer(id);
  hoverTimers.set(
    id,
    setTimeout(() => {
      hoverTimers.delete(id);
      open();
    }, delay),
  );
}

export function stopHoverTimer(id: string): void {
  clearTimeout(hoverTimers.get(id));
  hoverTimers.delete(id);
}
