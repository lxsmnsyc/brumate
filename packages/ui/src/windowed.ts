// The keys of a collection that renders only some of its rows, such as in a Virtualizer. Its
// rows are not all in the page, so the keys read the data of the items: their order, which are
// disabled, and the text of each. A collection whose items are written in markup has no data, and
// reads the page as `collection.ts` does.
import { itemsOf, keyOf, textOf, typeaheadKey } from './collection.ts';
import type { Key, Movement } from './collection.ts';

/** The element that scrolls a collection, or none for the page. */
export function scrollerOf(element: HTMLElement): HTMLElement | undefined {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (/^(auto|scroll|overlay)$/.test(style.overflowY || style.overflow)) {
      return parent;
    }
  }
  return undefined;
}

/** The height of a row that renders, from the space between the spacers of the window. */
export function measuredHeight(element: HTMLElement, role: string, fallback: number): number {
  const before = element.querySelector('[data-window=before]');
  const after = element.querySelector('[data-window=after]');
  const count = itemsOf(element, role).length;
  const height =
    before && after && count > 0
      ? (after.getBoundingClientRect().top - before.getBoundingClientRect().bottom) / count
      : 0;
  return height > 0 ? height : fallback;
}

/**
 * The keys of the rows that can take focus, in order: those of `order` that are not in
 * `disabledKeys`, and not disabled in the page, such as by an `isDisabled` of the row.
 */
export function enabledKeysOf(
  element: HTMLElement,
  role: string,
  order: readonly Key[],
  disabledKeys: readonly Key[],
): Key[] {
  const disabled = new Set(disabledKeys);
  for (const item of itemsOf(element, role)) {
    if (item.getAttribute('aria-disabled') === 'true') {
      disabled.add(keyOf(item)!);
    }
  }
  const enabled: Key[] = [];
  for (const key of order) {
    if (!disabled.has(key)) {
      enabled.push(key);
    }
  }
  return enabled;
}

/**
 * The key that a move reaches from a row, among the keys that can take focus. A page is the rows
 * that fit in the box. `wrap` goes from the last to the first and back.
 */
export function keyAfter(
  element: HTMLElement,
  role: string,
  order: readonly Key[],
  enabled: readonly Key[],
  from: Key,
  movement: Movement,
  rowHeight: number,
  wrap = false,
): Key {
  const places = new Map<Key, number>();
  for (const [index, key] of order.entries()) {
    places.set(key, index);
  }
  function place(key: Key) {
    return places.get(key) ?? -1;
  }
  const at = place(from);
  const before: Key[] = [];
  const after: Key[] = [];
  for (const key of enabled) {
    if (place(key) < at) {
      before.push(key);
    }
    if (place(key) > at) {
      after.push(key);
    }
  }
  const page = Math.max(
    1,
    Math.floor(
      (scrollerOf(element)?.clientHeight ?? window.innerHeight) /
        measuredHeight(element, role, rowHeight),
    ),
  );
  switch (movement) {
    case 'first':
      return enabled[0] ?? from;
    case 'last':
      return enabled.at(-1) ?? from;
    case 'next':
      return after[0] ?? (wrap ? enabled[0] : undefined) ?? from;
    case 'previous':
      return before.at(-1) ?? (wrap ? enabled.at(-1) : undefined) ?? from;
    case 'pageDown':
      for (let index = after.length - 1; index >= 0; index--) {
        if (place(after[index]!) <= at + page) {
          return after[index]!;
        }
      }
      return after[0] ?? from;
    case 'pageUp':
      for (const key of before) {
        if (place(key) >= at - page) {
          return key;
        }
      }
      return before.at(-1) ?? from;
  }
}

/** The latest move to a row that is out of view, by collection, so an earlier one does not win. */
const reveals = new WeakMap<Element, number>();

/**
 * Focuses the row of a key with `focus`. A windowed collection may not render the row, so it
 * scrolls the row into view first, and focuses it when it renders. Without a `rowHeight`, the
 * collection is not windowed, and the row is in the page or not there.
 */
export function focusKeyIn(
  element: HTMLElement,
  role: string,
  order: readonly Key[],
  key: Key,
  rowHeight: number | undefined,
  focus: (item: HTMLElement | undefined) => void,
): void {
  function find() {
    for (const item of itemsOf(element, role)) {
      if (keyOf(item) === key) {
        return item;
      }
    }
    return undefined;
  }
  const found = find();
  const turn = (reveals.get(element) ?? 0) + 1;
  reveals.set(element, turn);
  const at = order.indexOf(key);
  if (found || !rowHeight || at === -1) {
    focus(found);
    return;
  }
  const size = measuredHeight(element, role, rowHeight);
  const scroller = scrollerOf(element);
  const box = scroller?.getBoundingClientRect();
  const height = scroller?.clientHeight ?? window.innerHeight;
  // The rows start where the spacer before them does, below any header of the collection.
  const top = (element.querySelector('[data-window=before]') ?? element).getBoundingClientRect()
    .top;
  // The top of the row below the top of the rows, which puts the row in the middle of the box.
  const offset = at * size - (height - size) / 2;
  if (scroller && box) {
    scroller.scrollTop = Math.max(0, top - box.top + scroller.scrollTop + offset);
    scroller.dispatchEvent(new Event('scroll'));
  } else {
    window.scrollTo({ top: Math.max(0, window.scrollY + top + offset) });
  }
  // The window draws on the next frame after the scroll.
  function wait(frames: number) {
    const item = find();
    if (turn !== reveals.get(element)) {
      return;
    }
    if (item) {
      focus(item);
    } else if (frames > 0) {
      requestAnimationFrame(() => wait(frames - 1));
    }
  }
  wait(30);
}

/**
 * Adds a character to the typeahead of a windowed collection, and returns the key of the first row
 * from the focused one whose text starts with what was typed. A row in view has its own text, and
 * the others have the text of `getTextValue`. Returns undefined for a key that is not a character
 * of the typeahead.
 */
export function typeaheadWindowed(
  element: HTMLElement,
  role: string,
  rows: readonly { key: Key; item: unknown }[],
  enabled: readonly Key[],
  from: Key | undefined,
  event: KeyboardEvent,
  getTextValue: ((item: never) => string) | undefined,
): Key | undefined {
  const shown = new Map<Key | undefined, HTMLElement>();
  for (const item of itemsOf(element, role)) {
    shown.set(keyOf(item), item);
  }
  const allowed = new Set(enabled);
  const entries: { key: Key; text: string }[] = [];
  for (const row of rows) {
    if (!allowed.has(row.key)) {
      continue;
    }
    const item = shown.get(row.key);
    entries.push({
      key: row.key,
      text: item
        ? textOf(item)
        : (getTextValue?.(row.item as never) ?? '').trim().toLocaleLowerCase(),
    });
  }
  return typeaheadKey(element, entries, from, event);
}
