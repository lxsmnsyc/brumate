// The items of a collection, such as the options of a ListBox, read from the page. A part of
// brumate cannot read the structure of its children as React Aria reads them, so the order of the
// items is the order of their elements, and each element carries its key in `data-key`. Keyboard
// movement, ranges and typeahead work on these elements, so they work for items of any markup:
// written out, from a `#for`, or in sections.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** The key of an item: its `id`, a string or a number. */
export type Key = string | number;

/** The key of an item, as an element writes it in `data-key`. */
export function keyAttribute(key: Key): string {
  return JSON.stringify(key);
}

/** The key of the element of an item. */
export function keyOf(element: Element): Key | undefined {
  const raw = element.getAttribute('data-key');
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as Key;
  } catch {
    return raw;
  }
}

/**
 * The elements of the items of a collection, in order, without those of a collection inside.
 * `role` is the role of the items, or several separated by `|`, such as the roles of the items of
 * a menu.
 */
export function itemsOf(root: Element, role: string): HTMLElement[] {
  const selector = role
    .split('|')
    .map((name) => `[role=${name}][data-key]`)
    .join(', ');
  return [...root.querySelectorAll<HTMLElement>(selector)].filter(
    (item) => item.closest(`[data-collection]`) === root && !item.closest('[hidden]'),
  );
}

/** The items that can take focus: those that are not disabled. */
export function enabledItems(root: Element, role: string): HTMLElement[] {
  return itemsOf(root, role).filter((item) => item.getAttribute('aria-disabled') !== 'true');
}

/** The item of the collection that has focus. */
export function focusedItem(root: Element, role: string): HTMLElement | undefined {
  const active = document.activeElement;
  return itemsOf(root, role).find((item) => item === active);
}

/** Moves focus to an item, and keeps it in view. */
export function focusItem(item: HTMLElement | undefined): void {
  if (item) {
    item.focus({ preventScroll: true });
    item.scrollIntoView?.({ block: 'nearest' });
  }
}

/** The movement of a key: the next, the previous, the first, the last, or a page. */
export type Movement = 'next' | 'previous' | 'first' | 'last' | 'pageDown' | 'pageUp';

/** The movement of a key in a collection of an orientation, with the direction of the locale. */
export function movementOf(
  key: string,
  orientation: 'horizontal' | 'vertical',
  direction: 'ltr' | 'rtl',
): Movement | undefined {
  // Right to left, the arrow keys of a horizontal collection turn around.
  let next = 'ArrowDown';
  let previous = 'ArrowUp';
  if (orientation === 'horizontal') {
    next = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    previous = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  }
  switch (key) {
    case next:
      return 'next';
    case previous:
      return 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'PageDown':
      return 'pageDown';
    case 'PageUp':
      return 'pageUp';
    default:
      return undefined;
  }
}

/**
 * The item that a movement reaches from `from`, among the items that can take focus. `wrap`
 * goes from the last to the first and back. A page moves by the height of the collection.
 */
export function moveFrom(
  root: HTMLElement,
  items: HTMLElement[],
  from: HTMLElement | undefined,
  movement: Movement,
  wrap: boolean,
): HTMLElement | undefined {
  if (items.length === 0) {
    return undefined;
  }
  let at = from ? items.indexOf(from) : -1;
  // From an item that cannot take focus, such as a disabled one that a click focused, the moves
  // go from where it is: next is the first item after it, and previous the last before it.
  if (from && at === -1 && (movement === 'next' || movement === 'previous')) {
    const after = items.findIndex(
      (item) => from.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (movement === 'next') {
      return after === -1 ? (wrap ? items[0] : items.at(-1)) : items[after];
    }
    at = after === -1 ? items.length : after;
    return at === 0 ? (wrap ? items.at(-1) : items[0]) : items[at - 1];
  }
  switch (movement) {
    case 'first':
      return items[0];
    case 'last':
      return items.at(-1);
    case 'next':
      if (at === -1) {
        return items[0];
      }
      if (at === items.length - 1) {
        return wrap ? items[0] : items[at];
      }
      return items[at + 1];
    case 'previous':
      if (at === -1) {
        return items.at(-1);
      }
      if (at === 0) {
        return wrap ? items.at(-1) : items[0];
      }
      return items[at - 1];
    case 'pageDown':
    case 'pageUp': {
      // The item a height of the collection away, or the last one in that direction.
      const start = from ?? items[0]!;
      const height = root.clientHeight;
      const top = start.getBoundingClientRect().top;
      const target = movement === 'pageDown' ? top + height : top - height;
      const order = movement === 'pageDown' ? items.slice(at) : items.slice(0, at + 1).reverse();
      let found = order[0];
      for (const item of order) {
        const y = item.getBoundingClientRect().top;
        if (movement === 'pageDown' ? y > target : y < target) {
          break;
        }
        found = item;
      }
      return found;
    }
  }
}

/** The keys of the items from `anchor` to `to`, in order, without the disabled ones. */
export function keysBetween(items: HTMLElement[], anchor: Key, to: Key): Key[] {
  return keysIn(
    items.map((item) => keyOf(item)).filter((key): key is Key => key !== undefined),
    anchor,
    to,
  );
}

/** The keys from `anchor` to `to` in a list of keys, for a collection that is not all rendered. */
export function keysIn(keys: Key[], anchor: Key, to: Key): Key[] {
  const start = keys.indexOf(anchor);
  const end = keys.indexOf(to);
  if (start === -1 || end === -1) {
    return [to];
  }
  const [low, high] = start < end ? [start, end] : [end, start];
  return keys.slice(low, high + 1);
}

/** How long the letters of a typeahead add up, in milliseconds, as in React Aria. */
const TYPEAHEAD = 1000;

/** The text that a typeahead has, by its collection. */
const typed = new WeakMap<Element, { text: string; timer: ReturnType<typeof setTimeout> }>();

/** The text of an item that a typeahead matches: its `data-text-value`, or its text. */
export function textOf(item: HTMLElement): string {
  return (item.dataset.textValue ?? item.textContent ?? '').trim().toLocaleLowerCase();
}

/**
 * Adds a character to the typeahead of a collection, and returns the text it has. Space counts as
 * a character once something was typed. Returns undefined for a key that is not a character of
 * the typeahead.
 */
function typedText(root: Element, event: KeyboardEvent): string | undefined {
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
    return undefined;
  }
  const state = typed.get(root);
  if (event.key === ' ' && !state?.text) {
    return undefined;
  }
  clearTimeout(state?.timer);
  const text = (state?.text ?? '') + event.key.toLocaleLowerCase();
  typed.set(root, { text, timer: setTimeout(() => typed.delete(root), TYPEAHEAD) });
  return text;
}

/**
 * Adds a character to the typeahead of a collection, and returns the first item from the focused
 * one whose text starts with what was typed. Returns undefined for a key that is not a character
 * of the typeahead.
 */
export function typeahead(
  root: Element,
  items: HTMLElement[],
  from: HTMLElement | undefined,
  event: KeyboardEvent,
): HTMLElement | undefined {
  const text = typedText(root, event);
  if (text === undefined) {
    return undefined;
  }
  // The search starts at the focused item, so typing its first letter again keeps it.
  const at = from ? items.indexOf(from) : 0;
  const order = [...items.slice(Math.max(at, 0)), ...items.slice(0, Math.max(at, 0))];
  return order.find((item) => textOf(item).startsWith(text));
}

/** The same for items that are not all rendered: each has a key and its lowercase text. */
export function typeaheadKey(
  root: Element,
  items: { key: Key; text: string }[],
  from: Key | undefined,
  event: KeyboardEvent,
): Key | undefined {
  const text = typedText(root, event);
  if (text === undefined) {
    return undefined;
  }
  const at = Math.max(
    items.findIndex((item) => item.key === from),
    0,
  );
  const order = [...items.slice(at), ...items.slice(0, at)];
  return order.find((item) => item.text.startsWith(text))?.key;
}

/** True while a typeahead has text, so Space adds to it rather than selecting. */
export function isTyping(root: Element): boolean {
  return Boolean(typed.get(root)?.text);
}

/**
 * The range of a multiple selection, by its collection: its anchor, where it starts, and its end,
 * where Shift last extended it to.
 */
const ranges = new WeakMap<Element, { anchor: Key; end: Key }>();

export function rangeOf(root: Element): { anchor: Key; end: Key } | undefined {
  return ranges.get(root);
}

/** Starts a range at `anchor`, or moves the end of the range to `end`. */
export function setRange(root: Element, anchor: Key, end: Key = anchor): void {
  ranges.set(root, { anchor, end });
}

/** The item that had focus last, by its collection, which focus goes back to. */
const lastFocused = new WeakMap<Element, Key>();

export function lastFocusedOf(root: Element): Key | undefined {
  return lastFocused.get(root);
}

export function setLastFocused(root: Element, key: Key): void {
  lastFocused.set(root, key);
}

/** How a collection selects its items. */
export type SelectionMode = 'none' | 'single' | 'multiple';

/**
 * How a press selects: `toggle` adds and removes the item, as checkboxes do, and `replace` makes
 * it the selection, as a file manager does, with Ctrl or Cmd to add and Shift for a range.
 */
export type SelectionBehavior = 'toggle' | 'replace';

/** What a press or a key asks of the selection. */
export interface SelectionRequest {
  /** Shift: a range from the anchor. */
  shift: boolean;
  /** Ctrl or Cmd, or the toggle behavior: add or remove the item. */
  toggle: boolean;
}

/**
 * The selection after a press or a key on an item, as useMultipleSelectionState of React Aria
 * decides it. Disabled items are never selected.
 */
export function nextSelection(
  current: Key[],
  key: Key,
  options: {
    mode: SelectionMode;
    behavior: SelectionBehavior;
    disallowEmpty: boolean;
    request: SelectionRequest;
    /** The keys of a range from the anchor, for Shift. */
    range?: Key[];
    /** The keys of the range that Shift made before, which the new range replaces. */
    previousRange?: Key[];
    disabled: Key[];
  },
): Key[] {
  const { mode, behavior, disallowEmpty, request, range, previousRange = [], disabled } = options;
  if (mode === 'none' || disabled.includes(key)) {
    return current;
  }
  const selected = current.includes(key);
  const toggling = behavior === 'toggle' || request.toggle;
  let next: Key[];
  if (mode === 'single') {
    next = selected && toggling && !disallowEmpty ? [] : [key];
  } else if (request.shift && range) {
    // The range replaces the one before it. It replaces the selection, or adds to the rest of it
    // when items toggle.
    const rest = current.filter((item) => !previousRange.includes(item));
    next = behavior === 'toggle' ? [...new Set([...rest, ...range])] : range;
  } else if (toggling) {
    next = selected ? current.filter((item) => item !== key) : [...current, key];
    if (next.length === 0 && disallowEmpty) {
      next = current;
    }
  } else {
    next = [key];
  }
  return next.filter((item) => !disabled.includes(item));
}

/** True for two selections with the same keys. */
export function sameKeys(a: Key[], b: Key[]): boolean {
  return a.length === b.length && a.every((key) => b.includes(key));
}

/** What a ListBox gives its items and sections. */
export interface ListBoxState {
  selectionMode: SelectionMode;
  selectedKeys: Key[];
  disabledKeys: Key[];
  selectionBehavior: SelectionBehavior;
  /** Selects an item for a press, with its modifiers. */
  select: (key: Key, request: SelectionRequest) => void;
  /** Acts on an item, such as for Enter or a press with no selection. */
  action: (key: Key) => void;
  /** True when the ListBox has `onAction`. */
  hasAction: boolean;
  /** With focus in a field around the list, the item that its keys move to. */
  activeKey?: Key | null;
  /** With focus in a field around the list, makes an item the active one. */
  setActive?: (key: Key) => void;
  /** True when the rows can be dragged, in a GridList with `onReorder` or `getItems`. */
  isDraggable?: boolean;
  /** The keys of the rows that a drag moves. */
  dragging?: Key[];
  /** Where the rows that a drag moves would go. */
  dropTarget?: { key: Key; dropPosition: 'before' | 'after' } | null;
  /** Starts a drag of a row with the keys, from its drag button. */
  startDrag?: (key: Key) => void;
}

export const ListBoxContext: Context<ListBoxState | null> = createContext<ListBoxState | null>(
  'brumate-ui:list-box',
  null,
);

/**
 * What a part around a ListBox gives it, such as a Select: the selection that the part keeps, and
 * what a press or a key does with an item. The ListBox then keeps no selection of its own.
 */
export interface ListBoxGiven {
  selectedKeys: Key[];
  /** The ID of the element that names the list, such as the Label of a Select. */
  labelledBy?: string;
  /** A press, Enter or Space on an item. */
  select: (key: Key) => void;
  /** Tab on an item, which leaves the list. */
  tab?: () => void;
  /** The item that focus goes to when nothing is selected: the first, or the last for ArrowUp. */
  focusStrategy?: 'first' | 'last';
}

export const ListBoxGivenContext: Context<ListBoxGiven | null> = createContext<ListBoxGiven | null>(
  'brumate-ui:list-box-given',
  null,
);

/**
 * What a field around a collection gives it, such as the input of a ComboBox or an Autocomplete:
 * focus that stays in the field, and a filter. A ListBox and a Menu read it, and clear it for the
 * collections inside them.
 */
export interface CollectionFocus {
  /** The ID of the collection, which the field names, such as in `aria-controls`. */
  id?: string;
  /** `activeKey` is the item that the keys of the field move to, which `aria-activedescendant` names. */
  activeKey: Key | null;
  /** The pointer moved to an item, which becomes the active one. */
  setActive: (key: Key) => void;
  /**
   * The text that the items must match, such as what was typed. The collection hides the others
   * once it is on the page and when the text changes, and gives `filtered` the items that show.
   */
  filterText?: string;
  filter?: (text: string, input: string) => boolean;
  filtered?: (shown: HTMLElement[]) => void;
}

export const CollectionFocusContext: Context<CollectionFocus | null> =
  createContext<CollectionFocus | null>('brumate-ui:collection-focus', null);

/** What a section gives its Header: its ID, which names the section. */
export const SectionContext: Context<{ headerId: string } | null> = createContext<{
  headerId: string;
} | null>('brumate-ui:section', null);

/** What a Select gives its SelectValue: what to show in its Button. */
export interface SelectValueState {
  id: string;
  selectedKey: Key | null;
  /** The text of the selected item, once the Select has seen it. */
  selectedText: string | undefined;
  placeholder: string;
}

export const SelectValueContext: Context<SelectValueState | null> =
  createContext<SelectValueState | null>('brumate-ui:select-value', null);

/** The text of an item: its `data-text-value`, or its text. */
export function textOfItem(item: HTMLElement): string {
  return (item.dataset.textValue ?? item.textContent ?? '').trim();
}

/** True when the text of an item contains what was typed, in any case. */
export function contains(text: string, input: string): boolean {
  return text.toLocaleLowerCase().includes(input.trim().toLocaleLowerCase());
}

/**
 * Hides the items of a list whose text does not match, and the sections that have no item left.
 * The items are on the page, so they are hidden there, and the keys skip hidden items. Returns
 * the items that show.
 */
export function filterItems(
  list: Element,
  input: string,
  matches: (text: string, input: string) => boolean = contains,
  role = 'option',
): HTMLElement[] {
  const shown: HTMLElement[] = [];
  const selector = role
    .split('|')
    .map((name) => `[role=${name}][data-key]`)
    .join(', ');
  for (const item of list.querySelectorAll<HTMLElement>(selector)) {
    const visible = input === '' || matches(textOfItem(item), input);
    item.hidden = !visible;
    if (visible) {
      shown.push(item);
    }
  }
  for (const section of list.querySelectorAll<HTMLElement>('[role=group]')) {
    section.hidden = ![...section.querySelectorAll<HTMLElement>(selector)].some(
      (item) => !item.hidden,
    );
  }
  return shown;
}
