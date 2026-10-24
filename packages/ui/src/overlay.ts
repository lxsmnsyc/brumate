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
  returnTo: Element | null;
}

const held = new WeakMap<Element, Held>();

/** Keeps what an open overlay holds: the functions that stop what it started, and the focus. */
export function hold(overlay: Element, stops: (() => void)[], returnTo: Element | null): void {
  held.set(overlay, { stops, returnTo });
}

/**
 * Gives back what an open overlay held. Focus goes back to where it was, when it is still in
 * the overlay's layer or nowhere.
 */
export function release(overlay: Element, layer: Element | undefined): void {
  const entry = held.get(overlay);
  held.delete(overlay);
  for (const stop of entry?.stops ?? []) {
    stop();
  }
  const active = document.activeElement;
  if (!active || active === document.body || layer?.contains(active)) {
    (entry?.returnTo as HTMLElement | null)?.focus?.({ preventScroll: true });
  }
}
