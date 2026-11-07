// The state that a Menu shares with its trigger, its items and its submenus.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { StoreLike } from 'brumate/store';
import type { Key, SelectionMode } from './collection.ts';

/** The roles of the items of a menu: an action, a radio and a checkbox. */
export const MENU_ITEMS = 'menuitem|menuitemradio|menuitemcheckbox';

/**
 * Where focus goes when a menu opens: its first item, its last item, or the menu itself, as
 * after a press with a pointer.
 */
export type FocusStrategy = 'first' | 'last' | 'none';

/** What a MenuTrigger or a SubmenuTrigger gives the Menu inside its Popover. It changes, so it is in a store. */
export interface MenuTriggerState {
  /** The ID of the trigger, which names the menu. */
  triggerId: string;
  focusStrategy: FocusStrategy;
  /** True for a submenu, which ArrowLeft closes. */
  isSubmenu: boolean;
}

/** What a trigger gives: the store of its state, and its handler. Outside a trigger there is no handler. */
export interface MenuTriggerGiven {
  state: StoreLike<MenuTriggerState | null>;
  /** Closes the menu and every menu that it opened from. */
  closeAll?: () => void;
}

export const MenuTriggerContext: Context<MenuTriggerGiven> =
  createContext<MenuTriggerGiven>('brumate-ui:menu-trigger');

/** What a Menu gives its items. It changes, so it is in a store. */
export interface MenuState {
  selectionMode: SelectionMode;
  selectedKeys: Key[];
  disabledKeys: Key[];
  /** True inside a disabled Fieldset or Form. */
  isDisabled?: boolean;
  /** The ID of the item of this menu that has focus, which a SubmenuTrigger closes for. */
  focusedId: string | undefined;
  /** With focus in a field around the menu, the item that its keys move to. */
  activeKey?: Key | null;
}

/** What a Menu gives: the store of its state, and its handlers. Outside a menu there is no handler. */
export interface MenuGiven {
  state: StoreLike<MenuState | null>;
  /** Acts on an item: selects it, calls `onAction`, and closes the menu unless it stays open. */
  action?: (key: Key) => void;
  /** Closes this menu and every menu around it, after an action. */
  closeAll?: () => void;
  /** With focus in a field around the menu, makes an item the active one. */
  setActive?: (key: Key) => void;
}

export const MenuContext: Context<MenuGiven> = createContext<MenuGiven>('brumate-ui:menu');

/** What a SubmenuTrigger gives the MenuItem that opens it. It changes, so it is in a store. */
export interface SubmenuState {
  /** The ID that the item takes, which the submenu is placed next to. */
  triggerId: string;
  overlayId: string;
  isOpen: boolean;
}

/** What a SubmenuTrigger gives: the store of its state, and its handlers. */
export interface SubmenuGiven {
  state: StoreLike<SubmenuState | null>;
  /** Opens the submenu, and moves focus into it unless `focus` is false. */
  open?: (strategy: FocusStrategy, focus: boolean) => void;
  /** The pointer is on the item: the submenu opens after a delay. */
  hoverStart?: () => void;
  /** The pointer left the item before the delay. */
  hoverEnd?: () => void;
}

export const SubmenuContext: Context<SubmenuGiven> =
  createContext<SubmenuGiven>('brumate-ui:submenu');

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
