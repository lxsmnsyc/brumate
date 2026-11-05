// The state that Tabs share with their TabList, Tabs and TabPanels.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import type { StoreLike } from 'brumate/store';
import type { Key } from './collection.ts';

export interface TabsState {
  /** The key of the selected tab, or null for the first one. */
  selectedKey: Key | null;
  /**
   * The key of the first tab, which is selected when no key is. Each Tab writes its key here as
   * it renders, so the first one is known before the panels render, on the server too.
   */
  registry: { first?: Key };
  disabledKeys: Key[];
  isDisabled: boolean;
  orientation: 'horizontal' | 'vertical';
  keyboardActivation: 'automatic' | 'manual';
  /** The ID that the IDs of the tabs and the panels start with. */
  id: string;
}

/** What a Tab and a TabList call on their Tabs. */
export interface TabsHandlers {
  select: (key: Key) => void;
}

/** What Tabs gives: the store of its state, and its handler. Outside Tabs there is no handler. */
export interface TabsGiven extends Partial<TabsHandlers> {
  state: StoreLike<TabsState | null>;
}

export const TabsContext: Context<TabsGiven> = createContext<TabsGiven>('brumate-ui:tabs');

/** The key of the selected tab: the one that Tabs hold, or the first one. */
export function getSelectedKey(tabs: TabsState): Key | undefined {
  return tabs.selectedKey ?? tabs.registry.first;
}

/** The ID of the element of a tab, or of its panel, from the ID of the Tabs and its key. */
export function tabId(tabs: TabsState, key: Key, part: 'tab' | 'panel'): string {
  return `${tabs.id}-${part}-${String(key).replace(/[^\w-]/g, '_')}`;
}
