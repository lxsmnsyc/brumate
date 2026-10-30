import { keepStyle } from './position.ts';

// The page around an open overlay: what is inert behind it, where focus goes in it, and when a
// press outside closes it. They hide the page with `inert` in place of aria-hidden.

let loading: Promise<void> = Promise.resolve();

/**
 * Runs the open of an overlay that starts open, after the ones before it. Two modals that start
 * open then stack as two opened by presses do: the later one is on top, the earlier one is inert
 * under it, and neither marks the other inert while it is still opening.
 */
export function queueLoad(open: () => Promise<void> | undefined): void {
  loading = loading.then(open).catch(() => undefined);
}

/** Whether the element takes text, such as an input a reader is typing in. */
export function takesText(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), iframe, summary, [contenteditable], [tabindex]';

/** The elements inside `root` that Tab reaches, in order. */
export function tabbables(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest('[inert], [hidden]') &&
      (typeof element.checkVisibility !== 'function' || element.checkVisibility()),
  );
}

/**
 * Moves focus into the overlay: to the element with `autofocus`, or else to the overlay itself,
 * so a screen reader starts at its label.
 */
export function focusInto(overlay: HTMLElement): void {
  const target = overlay.querySelector<HTMLElement>('[autofocus]') ?? overlay;
  target.focus({ preventScroll: true });
}

/**
 * Keeps Tab inside the overlay. The wrapper of the handler prevents Tab, so this moves focus to
 * the next or the previous element of the overlay, and wraps at its ends.
 */
export function containTab(overlay: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') {
    return;
  }
  const order = tabbables(overlay);
  if (order.length === 0) {
    overlay.focus({ preventScroll: true });
    return;
  }
  const at = order.indexOf(document.activeElement as HTMLElement);
  let next: HTMLElement | undefined;
  if (event.shiftKey) {
    next = at <= 0 ? order.at(-1) : order[at - 1];
  } else {
    next = at === -1 || at === order.length - 1 ? order[0] : order[at + 1];
  }
  next?.focus();
}

/** How many open overlays made each element inert, so the last one to close gives it back. */
const inertCounts = new Map<Element, number>();

/** True for an element that a modal leaves alone. The toasts stay usable. */
function keepsUsable(element: Element): boolean {
  return (
    element.hasAttribute('data-toast-region') ||
    /^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(element.tagName)
  );
}

/** Makes an element inert for one more overlay. An element that was inert before stays as it was. */
function addInert(element: Element, changed: Element[]): void {
  const count = inertCounts.get(element) ?? 0;
  if (count === 0 && element.hasAttribute('inert')) {
    return;
  }
  inertCounts.set(element, count + 1);
  element.setAttribute('inert', '');
  changed.push(element);
}

function removeInert(element: Element): void {
  const count = (inertCounts.get(element) ?? 1) - 1;
  if (count > 0) {
    inertCounts.set(element, count);
    return;
  }
  inertCounts.delete(element);
  element.removeAttribute('inert');
}

/**
 * Makes every element of the page inert except the layer of the overlay and the elements that
 * hold it. Each element counts the overlays that made it
 * inert, so overlays can close in any order. Elements that come into the page while it is open
 * become inert too. Returns the function that gives them back what they had.
 */
export function inertOutside(layer: Element): () => void {
  const changed: Element[] = [];
  const holders: Element[] = [];
  for (let current: Element | null = layer; current && current !== document.body;) {
    const parent: Element | null = current.parentElement;
    if (parent) {
      holders.push(parent);
    }
    for (const sibling of parent?.children ?? []) {
      if (sibling !== current && !keepsUsable(sibling)) {
        addInert(sibling, changed);
      }
    }
    current = parent;
  }
  const observer =
    typeof MutationObserver === 'function'
      ? new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              // The layer of an overlay that opens later is above this one.
              if (
                node instanceof Element &&
                !node.contains(layer) &&
                !node.hasAttribute('data-layer') &&
                !keepsUsable(node)
              ) {
                addInert(node, changed);
              }
            }
          }
        })
      : undefined;
  for (const holder of holders) {
    observer?.observe(holder, { childList: true });
  }
  return () => {
    observer?.disconnect();
    for (const element of changed) {
      removeInert(element);
    }
  };
}

/** The layers of the overlays that close on a press outside, the topmost last. */
const dismissable: Element[] = [];

/**
 * Calls `close` on a press outside the layer, except on the trigger, which toggles the overlay
 * itself. The press is a pointerdown and a pointerup of the
 * first button, and only the topmost overlay closes. A layer holds the layers of the overlays
 * that open inside it, so a press in one of them is inside. Returns the function that stops it.
 */
export function pressOutside(
  layer: Element,
  trigger: Element | null,
  close: () => void,
): () => void {
  dismissable.push(layer);
  let started = false;
  const outside = (event: PointerEvent): boolean => {
    const target = event.target as Node | null;
    return (
      event.button === 0 &&
      dismissable.at(-1) === layer &&
      target !== null &&
      !layer.contains(target) &&
      !trigger?.contains(target)
    );
  };
  const down = (event: PointerEvent): void => {
    started = outside(event);
  };
  const up = (event: PointerEvent): void => {
    if (started && outside(event)) {
      close();
    }
    started = false;
  };
  // A pointer that the browser takes over, such as a touch that scrolls the page, is no press.
  const cancel = (): void => {
    started = false;
  };
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', cancel, true);
  return () => {
    dismissable.splice(dismissable.indexOf(layer), 1);
    document.removeEventListener('pointerdown', down, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', cancel, true);
  };
}

/**
 * Calls `close` when focus moves outside the layer and the trigger, for an overlay that is not
 * modal. Returns the function that stops it.
 */
export function blurOutside(
  layer: Element,
  trigger: Element | null,
  close: () => void,
): () => void {
  const listener = (event: FocusEvent): void => {
    const target = event.target as Node | null;
    if (target && !layer.contains(target) && !trigger?.contains(target)) {
      close();
    }
  };
  document.addEventListener('focusin', listener, true);
  return () => document.removeEventListener('focusin', listener, true);
}

/** The layers of the open overlays that close on Escape from outside, the topmost last. */
const escapable: Element[] = [];

/**
 * Calls `close` on Escape while focus is outside the layer, for an overlay that is not modal:
 * when focus is on its trigger, or on nothing. Focus in a field or in another layer keeps the
 * key, and so does a key that a part used. Only the topmost such overlay closes. Returns a
 * function that stops.
 */
export function escapeOutside(
  layer: Element,
  trigger: Element | null,
  close: () => void,
): () => void {
  escapable.push(layer);
  const listener = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || escapable.at(-1) !== layer) {
      return;
    }
    // A layer that comes later in the page, such as a dialog or a menu, is above this one.
    for (const other of document.querySelectorAll('[data-layer]')) {
      if (
        other !== layer &&
        layer.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        return;
      }
    }
    const active = document.activeElement;
    const free = !active || active === document.body;
    // The trigger can be in a layer of its own, such as a dialog. That layer is not above.
    const onTrigger =
      Boolean(trigger?.contains(active)) &&
      active?.closest('[data-layer]') === trigger?.closest('[data-layer]');
    if (free || onTrigger) {
      // This runs first, so the layer around the trigger sees a key that is used, and stays.
      event.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', listener, true);
  return () => {
    document.removeEventListener('keydown', listener, true);
    const at = escapable.indexOf(layer);
    if (at >= 0) {
      escapable.splice(at, 1);
    }
  };
}

/** What an open overlay holds on the page, which closing gives back, by its element. */
interface Held {
  stops: (() => void)[];
  /** The element that had focus before the overlay opened. */
  returnTo: Element | null;
  /** Where the selection was, for when no element had focus, as Terracotta keeps it. */
  startPoint: HTMLElement | null;
  /** The ID of the trigger, which a trigger that rendered again keeps. */
  triggerId: string | undefined;
  /**
   * Gives focus back only from inside the overlay, for an overlay that never took focus, such as
   * a preview.
   */
  fromInside: boolean;
}

const held = new WeakMap<Element, Held>();

/**
 * Where focus should go back to, from an overlay that closed while another still made the page
 * inert. With transitions, two overlays that close in one step end one after the other, and the
 * first to end finds its target still inert. The next one to end tries these when its own fail.
 */
let orphans: HTMLElement[] = [];

/** The layers that gave back what they held. Their markup is about to leave the page. */
const released = new WeakSet<Element>();

/** True for an element inside a layer that already gave back what it held. */
function inReleased(element: Element): boolean {
  const layer = element.closest('[data-layer]');
  return layer !== null && released.has(layer);
}

/** Finds the element that can take focus back among the candidates, and gives it focus. */
function focusBack(candidates: (Element | null | undefined)[]): boolean {
  for (const candidate of candidates) {
    if (canFocus(candidate) && !inReleased(candidate)) {
      candidate.focus({ preventScroll: true });
      return true;
    }
  }
  return false;
}

/** The element of the selection, which Tab moves on from when no element has focus. */
function selectionPoint(): HTMLElement | null {
  const node = window.getSelection()?.focusNode;
  // The focus of a selection is a text node, or an element when the selection ends between nodes.
  return node instanceof HTMLElement ? node : (node?.parentElement ?? null);
}

/**
 * Makes `element` the point that the next Tab moves on from, without leaving focus on it: it
 * takes focus for a moment, as Terracotta does.
 */
function setStartPoint(element: HTMLElement): void {
  const tabindex = element.getAttribute('tabindex');
  element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  element.blur();
  if (tabindex === null) {
    element.removeAttribute('tabindex');
  } else {
    element.setAttribute('tabindex', tabindex);
  }
}

/** True for an element that can take focus back: in the page, and not inert or disabled. */
function canFocus(element: Element | null | undefined): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element !== document.body &&
    element.isConnected &&
    !element.closest('[inert]') &&
    !(element as HTMLButtonElement).disabled
  );
}

/**
 * Keeps what an open overlay holds: the functions that stop what it started, and where focus
 * was before it opened. An overlay that shows again while it is open first gives back what it
 * held, so the page that it made inert is not taken as the page before it opened. It keeps
 * where focus was before the first.
 */
export function hold(
  overlay: Element,
  stops: (() => void)[],
  returnTo: Element | null,
  triggerId?: string,
  fromInside = false,
): void {
  const before = held.get(overlay);
  for (const stop of before?.stops ?? []) {
    stop();
  }
  held.set(
    overlay,
    before
      ? { ...before, stops, triggerId }
      : { stops, returnTo, startPoint: selectionPoint(), triggerId, fromInside },
  );
}

/**
 * Gives back what an open overlay held. Focus goes back when it is still in the overlay's layer
 * or nowhere, so a closing overlay never takes it from where the user just put it. It goes to
 * the element that had it before the overlay opened, or else to the trigger, found again by its
 * ID, or else Tab moves on from where the selection was.
 */
export function release(overlay: Element, layer: Element | undefined): void {
  const entry = held.get(overlay);
  if (!entry) {
    return;
  }
  held.delete(overlay);
  if (layer) {
    released.add(layer);
  }
  for (const stop of entry.stops) {
    stop();
  }
  const waiting = orphans;
  orphans = [];
  const active = document.activeElement;
  if (active && active !== document.body && !layer?.contains(active) && active.isConnected) {
    return;
  }
  if (entry.fromInside && !(active && layer?.contains(active))) {
    return;
  }
  const trigger = entry.triggerId ? document.getElementById(entry.triggerId) : null;
  if (focusBack([entry.returnTo, trigger])) {
    return;
  }
  if (focusBack(waiting)) {
    return;
  }
  // The target is in the page but inert, because an overlay above or beside this one has not
  // given the page back yet. The one that does tries it.
  orphans.push(...waiting);
  for (const target of [entry.returnTo, trigger]) {
    if (target instanceof HTMLElement && target.isConnected && target.closest('[inert]')) {
      orphans.push(target);
      break;
    }
  }
  if (entry.startPoint?.isConnected) {
    setStartPoint(entry.startPoint);
  }
}

/**
 * Keeps focus in a modal overlay. Focus that
 * lands outside its layer, or on nothing, such as when the focused element is removed, goes
 * back to the last element that had focus in the layer, or to the overlay. Returns the
 * function that stops it.
 */
export function keepFocus(layer: Element, overlay: HTMLElement): () => void {
  let last: HTMLElement = overlay;
  const back = (): void => {
    (last.isConnected && !last.closest('[inert]') ? last : overlay).focus({ preventScroll: true });
  };
  const focusIn = (event: FocusEvent): void => {
    const target = event.target as HTMLElement;
    if (layer.contains(target)) {
      last = target;
    } else if (layer.closest('[inert]')) {
      // Another overlay opened above this one and made it inert, so focus belongs to that one.
    } else if (!target.closest?.('[data-toast-region]')) {
      back();
    }
  };
  // Focus that leaves for nothing fires no focusin, so the next frame checks where it went.
  let frame = 0;
  const focusOut = (event: FocusEvent): void => {
    if (event.relatedTarget === null) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          back();
        }
      });
    }
  };
  document.addEventListener('focusin', focusIn);
  layer.addEventListener('focusout', focusOut as EventListener);
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('focusin', focusIn);
    layer.removeEventListener('focusout', focusOut as EventListener);
  };
}

/** How many open overlays lock the scroll of the page. */
let scrollLocks = 0;
let unlockScroll: (() => void) | undefined;

/**
 * Stops the page from scrolling while a modal overlay is open. The root gets `overflow: hidden`,
 * and a padding as wide as the scrollbar that it hid, so the page does not move sideways. Nested
 * overlays share one lock. Returns the function that gives it back.
 */
export function lockScroll(): () => void {
  if (scrollLocks++ === 0) {
    const root = document.documentElement;
    const { overflow, paddingRight } = root.style;
    const scrollbar = window.innerWidth - root.clientWidth;
    // A root with `scrollbar-gutter: stable` keeps the space of the scrollbar itself.
    const gutter = getComputedStyle(root).scrollbarGutter?.startsWith('stable');
    if (scrollbar > 0 && !gutter) {
      const padding = Number.parseFloat(getComputedStyle(root).paddingRight) || 0;
      root.style.paddingRight = `${padding + scrollbar}px`;
    }
    root.style.overflow = 'hidden';
    unlockScroll = () => {
      root.style.overflow = overflow;
      root.style.paddingRight = paddingRight;
    };
  }
  let locked = true;
  return () => {
    if (locked) {
      locked = false;
      if (--scrollLocks === 0) {
        unlockScroll?.();
        unlockScroll = undefined;
      }
    }
  };
}

/**
 * Keeps `--visual-viewport-height` on the element, the height of the part of the page in view,
 * which a keyboard on the screen makes smaller. Returns the function that stops it.
 */
export function followViewport(element: HTMLElement): () => void {
  const viewport = window.visualViewport;
  const { put, stop } = keepStyle(element);
  const update = (): void => {
    put(
      '--visual-viewport-height',
      `${viewport?.height ?? document.documentElement.clientHeight}px`,
    );
  };
  update();
  viewport?.addEventListener('resize', update);
  window.addEventListener('resize', update);
  return () => {
    viewport?.removeEventListener('resize', update);
    window.removeEventListener('resize', update);
    stop();
  };
}
