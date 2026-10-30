// `#for` and `#repeat` lists, and the windowed lists that draw only the items in view.

import { parseId } from '../shared.ts';
import { blockStart, clear, rangeEnd } from './blocks.ts';
import type { Render } from './branches.ts';
import { insertHTML, refresh } from './insert.ts';
import { destroy, disposeKinds, inPlace } from './scopes.ts';
import { scopes } from './state.ts';
import type { Scope } from './state.ts';

interface Item {
  scope: Scope;
  /** The first and last node of the item, which are the same node for one element. */
  first: Node;
  last: Node;
  /** The place of the item in the list before the update. */
  position: number;
  /** True for an item whose key is in the new list. */
  kept: boolean;
  /** True for a kept item that stays in place. */
  still: boolean;
}

const ITEM_MARKER = /^i(-?[\d.]+)$/;

/** Updates the items of `#for` or `#repeat`, keeping the elements of items whose keys stay. */
/** The items of a `#for` list: an array as it is, since `list` only reads it, or any iterable as an array. */
export function listOf(value: Iterable<unknown> | ArrayLike<unknown>): unknown[] {
  return Array.isArray(value) ? value : Array.from(value);
}

export function list(
  scope: Scope,
  anchor: number,
  items: unknown[],
  key: (item: unknown, index: number) => unknown,
  given: Render,
  assign: (scope: Scope, item: unknown, index: number) => void,
  givenFallback: Render | undefined,
  fallbackKinds: number[],
  holderKind?: number,
  holderAnchor?: number,
  park?: Parking,
): void {
  const start = blockStart(scope, anchor);
  if (!start) {
    return;
  }
  const render = inPlace(scope, given, holderKind, holderAnchor)!;
  const fallback = inPlace(scope, givenFallback, holderKind, holderAnchor);
  const end = rangeEnd(start);
  const previous = new Map<unknown, Item>();
  let others: Node[] | undefined;
  let position = 0;
  for (let node = start.nextSibling; node && node !== end;) {
    // An item between `<!--i…-->` and `<!--/i-->`, or one element whose `b-b` names the scope.
    let data: string | undefined;
    let id: string | undefined;
    if (node.nodeType === 8) {
      data = (node as Comment).data;
      id = ITEM_MARKER.exec(data)?.[1];
    } else if (node.nodeType === 1) {
      const bound = (node as Element).getAttribute('b-b');
      id = bound === null ? undefined : bound.slice(0, bound.indexOf(':'));
    }
    const item = id === undefined ? undefined : scopes.get(parseId(id));
    let last: Node = node;
    // The elements of the fallback have scopes of its kinds.
    if (item && (data !== undefined || (item.p === scope && !fallbackKinds.includes(item.k)))) {
      if (data !== undefined) {
        last = rangeEnd(node as Comment);
      }
      // An item of a windowed list has the index that it had in the whole list in its key.
      previous.set(key(item.i, position + (park?.was ?? 0)), {
        scope: item,
        first: node,
        last,
        position: position++,
        kept: false,
        still: false,
      });
    } else {
      (others ??= []).push(node);
    }
    node = last.nextSibling;
  }

  const count = items.length;
  // An item that leaves a windowed list, but stays in its list, keeps its scope and nodes.
  function leave(id: unknown, item: Item): void {
    if (park?.stays(id)) {
      const nodes = document.createDocumentFragment();
      for (let node: Node | null = item.first; node;) {
        const next: Node | null = node === item.last ? null : node.nextSibling;
        nodes.append(node);
        node = next;
      }
      park.items.set(id, { scope: item.scope, nodes });
      return;
    }
    destroy(item.scope);
    for (let node: Node | null = item.first; node;) {
      const next: Node | null = node === item.last ? null : node.nextSibling;
      node.parentNode?.removeChild(node);
      node = next;
    }
  }
  // A windowed list with no item in view is not empty, so it does not show its fallback.
  if (count === 0 && !(park && park.total > 0)) {
    if (previous.size === 0 && others) {
      return;
    }
    for (const [id, item] of previous) {
      leave(id, item);
    }
    clear(start, end);
    if (fallback) {
      insertHTML(end, fallback(scope));
    }
    return;
  }

  disposeKinds(scope, fallbackKinds);
  if (others) {
    for (const node of others) {
      node.parentNode?.removeChild(node);
    }
  }
  const parent = end.parentNode!;
  // The key of each item, and the items that stay, in the new order. A key that repeats keeps
  // its item once, as below.
  const keys: unknown[] = Array.from({ length: count });
  const kept: Item[] = [];
  for (let index = 0; index < count; index++) {
    const id = (keys[index] = key(items[index], index + (park?.from ?? 0)));
    const item = previous.get(id);
    if (item && !item.kept) {
      item.kept = true;
      kept.push(item);
    }
  }
  // The items that stay in place: the longest run of them that keeps the old order. Only the
  // others move, because moving a node restarts its animations and drops its focus.
  markInPlace(kept);
  // When no item stays, the old ones go first, in one removal, and the new ones go in after.
  if (kept.length === 0 && previous.size > 0 && !park) {
    for (const item of previous.values()) {
      destroy(item.scope);
    }
    previous.clear();
    clear(start, end);
  }
  // The first node after the items placed so far.
  let cursor: Node = start.nextSibling!;
  // New items next to each other go into the page with one insert: their HTML, or the
  // fragments that they cloned.
  let added = '';
  let addedNodes: DocumentFragment[] | undefined;
  function flushAdded(): void {
    if (added) {
      insertHTML(cursor, added);
      added = '';
    } else if (addedNodes) {
      insertHTML(cursor, addedNodes);
    }
    addedNodes = undefined;
  }
  for (let index = 0; index < count; index++) {
    const id = keys[index];
    const item = previous.get(id);
    const parked = item ? undefined : park?.items.get(id);
    if (parked) {
      // An item of a windowed list that comes back into view, with its scope and nodes.
      flushAdded();
      park!.items.delete(id);
      parent.insertBefore(parked.nodes, cursor);
      assign(parked.scope, items[index], index);
      (park!.back ??= []).push(parked.scope);
      continue;
    }
    if (!item) {
      const out = render(scope, items[index], index);
      if (typeof out === 'string') {
        added += out;
      } else {
        (addedNodes ??= []).push(out);
      }
      continue;
    }
    // Before the item's updates run, so they see the new items before it.
    flushAdded();
    previous.delete(id);
    // Slots that keep their values do not trigger updates.
    assign(item.scope, items[index], index);
    if (item.still) {
      // The nodes between the cursor and the item belong to items that move or go.
      cursor = item.last.nextSibling!;
    } else {
      for (let node = item.first; ;) {
        const next = node.nextSibling;
        parent.insertBefore(node, cursor);
        if (node === item.last) {
          break;
        }
        node = next!;
      }
    }
  }
  flushAdded();
  for (const [id, item] of previous) {
    leave(id, item);
  }
  // The updates of an item that was out of the page did not reach its nodes, so it catches up.
  if (park?.back) {
    const back = park.back.splice(0);
    refresh(back);
    // The windows inside an item that came back draw for the box as it is now.
    for (const item of back) {
      redraw(item);
    }
  }
}

/** Draws the windowed lists of a scope and of the scopes inside it. */
function redraw(scope: Scope): void {
  for (const state of windows.get(scope)?.values() ?? []) {
    state.draw?.();
  }
  for (const child of scope.children ?? []) {
    redraw(child);
  }
}

/** What a windowed list keeps between draws: its parked items and the height of an item. */
interface WindowState {
  parked: Parking['items'];
  /** The height of an item, from the items that rendered, once they have. */
  measured?: number;
  /** Draws the window with the latest items, for a scroll. */
  draw?: () => void;
  /** The index in the whole list of the first item that is in the page. */
  from: number;
  frame?: number;
}

const windows = new WeakMap<Scope, Map<number, WindowState>>();

/**
 * The element that scrolls a windowed list, or none for the page. An element scrolls the list
 * when it can scroll vertically: its overflow allows it, and its content is taller than it.
 * A wrapper without a height, such as one that scrolls sideways, grows with the list and has
 * nothing to scroll, so the list looks further up. The server renders enough items to fill
 * the box, so its content is taller from the first draw on.
 */
function findScroller(node: Node): HTMLElement | undefined {
  for (let element = node.parentElement; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (
      /^(auto|scroll|overlay)$/.test(style.overflowY || style.overflow) &&
      element.scrollHeight > element.clientHeight
    ) {
      return element;
    }
  }
  return undefined;
}

/**
 * Renders the items of a windowed list that are in view, from `#for … window(height, count)`,
 * with `list`, between the spacers that the server wrote before and after the block. Items that
 * leave the view keep their scopes and nodes while they are in the list.
 */
export function windowList(
  scope: Scope,
  anchor: number,
  items: unknown[],
  key: (item: unknown, index: number) => unknown,
  render: Render,
  assign: (scope: Scope, item: unknown, index: number) => void,
  fallback: Render | undefined,
  fallbackKinds: number[],
  height: number,
  holderKind?: number,
  holderAnchor?: number,
): void {
  const byAnchor = windows.get(scope) ?? new Map<number, WindowState>();
  windows.set(scope, byAnchor);
  let state = byAnchor.get(anchor);
  if (!state) {
    state = { parked: new Map(), from: 0 };
    byAnchor.set(anchor, state);
  }
  const window = state;
  window.draw = () => {
    const start = blockStart(scope, anchor);
    if (!start) {
      return;
    }
    const end = rangeEnd(start);
    const before = start.previousSibling as HTMLElement | null;
    const after = end.nextSibling as HTMLElement | null;
    if (!before?.hasAttribute?.('data-window') || !after?.hasAttribute?.('data-window')) {
      return;
    }
    const size = window.measured ?? height;
    const top = before.getBoundingClientRect().top;
    const scroller = findScroller(start);
    const view = scroller
      ? scroller.getBoundingClientRect()
      : { top: 0, bottom: document.documentElement.clientHeight };
    // A few items more on each side, so a scroll shows rendered items.
    const extra = 3;
    const count = items.length;
    const from = Math.min(count, Math.max(0, Math.floor((view.top - top) / size) - extra));
    const to = Math.min(count, Math.max(from, Math.ceil((view.bottom - top) / size) + extra));
    const keys = new Set<unknown>();
    for (const [index, item] of items.entries()) {
      keys.add(key(item, index));
    }
    const was = window.from;
    window.from = from;
    list(
      scope,
      anchor,
      items.slice(from, to),
      key,
      (parent, item, index) => render(parent, item, index === undefined ? index : index + from),
      (item, value, index) => assign(item, value, index + from),
      fallback,
      fallbackKinds,
      holderKind,
      holderAnchor,
      { items: window.parked, stays: (id) => keys.has(id), was, from, total: count },
    );
    // Items that left the list for good go.
    for (const [id, parked] of window.parked) {
      if (!keys.has(id)) {
        window.parked.delete(id);
        destroy(parked.scope);
      }
    }
    before.style.height = `${from * size}px`;
    after.style.height = `${(count - to) * size}px`;
    // The height of an item, from those that rendered.
    if (to > from) {
      const rendered = after.getBoundingClientRect().top - before.getBoundingClientRect().bottom;
      if (rendered > 0) {
        window.measured = rendered / (to - from);
      }
    }
  };
  window.draw();
}

/**
 * Starts the window of a windowed list that the server rendered: it draws now, and again as
 * the page or the element that scrolls the list scrolls or resizes.
 */
export function windowStart(scope: Scope, anchor: number, draw: () => void): void {
  draw();
  const window = windows.get(scope)?.get(anchor);
  const start = blockStart(scope, anchor);
  if (!window || !start) {
    return;
  }
  const scroller = findScroller(start);
  const target: EventTarget = scroller ?? globalThis;
  let observer: ResizeObserver | undefined;
  // An arrow, to keep the narrowing of `start` and `window`.
  const schedule = (): void => {
    // A scope that is gone stops listening for good.
    if (!scopes.has(scope.id)) {
      target.removeEventListener('scroll', schedule);
      globalThis.removeEventListener('resize', schedule);
      observer?.disconnect();
      return;
    }
    // An item that is out of the page for a while draws when it comes back.
    if (!start.isConnected) {
      return;
    }
    if (window.frame === undefined) {
      window.frame = requestAnimationFrame(() => {
        window.frame = undefined;
        window.draw?.();
      });
    }
  };
  target.addEventListener('scroll', schedule, { passive: true });
  globalThis.addEventListener('resize', schedule, { passive: true });
  // The box can change its size without the window, such as when a panel around it opens.
  if (scroller && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    observer.observe(scroller);
  }
}

/** The items of a windowed list that are out of view, which keep their scopes and nodes. */
interface Parking {
  items: Map<unknown, { scope: Scope; nodes: DocumentFragment }>;
  /** Whether a key is still in the list, so its item keeps its scope when it leaves the view. */
  stays: (key: unknown) => boolean;
  /** The index in the whole list of the first item that was in the page before. */
  was: number;
  /** The index in the whole list of the first item that is in the page now. */
  from: number;
  /** The number of items in the whole list, also when none is in view. */
  total: number;
  /** The scopes of items that came back, which refresh. */
  back?: Scope[];
}

/**
 * Marks the items of a list that keep their places: the longest run of `kept`, the items that
 * stay in their new order, whose old positions go up.
 */
function markInPlace(kept: Item[]): void {
  let sorted = true;
  for (let index = 1; index < kept.length; index++) {
    if (kept[index - 1]!.position > kept[index]!.position) {
      sorted = false;
      break;
    }
  }
  if (sorted) {
    for (const item of kept) {
      item.still = true;
    }
    return;
  }
  // `tails[length - 1]` is the index of the item that ends the run of that length with the
  // lowest position, and `before` links each item to the item before it in its run.
  const tails: number[] = [];
  const before: number[] = [];
  for (let index = 0; index < kept.length; index++) {
    const position = kept[index]!.position;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (kept[tails[middle]!]!.position < position) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    before[index] = low > 0 ? tails[low - 1]! : -1;
    tails[low] = index;
  }
  for (let index = tails.at(-1) ?? -1; index >= 0; index = before[index]!) {
    kept[index]!.still = true;
  }
}
