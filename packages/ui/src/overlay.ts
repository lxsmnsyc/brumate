// The page around an open overlay: what is inert behind it, where focus goes in it, and when a
// press outside closes it. These follow FocusScope, ariaHideOutside and useInteractOutside of
// React Aria, with `inert` in place of aria-hidden.

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
 * as the Dialog of React Aria does, so a screen reader starts at its label.
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

/**
 * Makes every element of the page inert except the layer of the overlay and the elements that
 * hold it. Returns the function that gives them back what they had.
 */
export function inertOutside(layer: Element): () => void {
  const changed: Element[] = [];
  for (let current: Element | null = layer; current && current !== document.body;) {
    const parent: Element | null = current.parentElement;
    for (const sibling of parent?.children ?? []) {
      if (
        sibling !== current &&
        !sibling.hasAttribute('inert') &&
        !/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(sibling.tagName)
      ) {
        sibling.setAttribute('inert', '');
        changed.push(sibling);
      }
    }
    current = parent;
  }
  return () => {
    for (const element of changed) {
      element.removeAttribute('inert');
    }
  };
}

/**
 * Calls `close` on a press that starts outside the layer, except on the trigger, which toggles
 * the overlay itself. A layer holds the layers of the overlays that open inside it, so a press
 * in one of them is inside. Returns the function that stops it.
 */
export function pressOutside(
  layer: Element,
  trigger: Element | null,
  close: () => void,
): () => void {
  const listener = (event: PointerEvent): void => {
    const target = event.target as Node | null;
    if (!target || layer.contains(target) || trigger?.contains(target)) {
      return;
    }
    close();
  };
  document.addEventListener('pointerdown', listener, true);
  return () => document.removeEventListener('pointerdown', listener, true);
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
}

const held = new WeakMap<Element, Held>();

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
 * was before it opened.
 */
export function hold(
  overlay: Element,
  stops: (() => void)[],
  returnTo: Element | null,
  triggerId?: string,
): void {
  held.set(overlay, { stops, returnTo, startPoint: selectionPoint(), triggerId });
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
  for (const stop of entry.stops) {
    stop();
  }
  const active = document.activeElement;
  if (active && active !== document.body && !layer?.contains(active) && active.isConnected) {
    return;
  }
  const trigger = entry.triggerId ? document.getElementById(entry.triggerId) : null;
  if (canFocus(entry.returnTo)) {
    entry.returnTo.focus({ preventScroll: true });
  } else if (canFocus(trigger)) {
    trigger.focus({ preventScroll: true });
  } else if (entry.startPoint?.isConnected) {
    setStartPoint(entry.startPoint);
  }
}

/**
 * Keeps focus in a modal overlay, as the `contain` of FocusScope in React Aria does. Focus that
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
    } else {
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
