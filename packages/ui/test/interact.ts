// Keyboard and focus for the tests of the parts. happy-dom does not move focus with Tab, so
// `tab` finds the next element that Tab reaches, as a browser does.

const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, [contenteditable], [tabindex]';

/** True for an element that a browser shows: none of it, or of its parents, is hidden. */
function shown(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('hidden') || current.hasAttribute('inert')) {
      return false;
    }
  }
  return true;
}

/** The elements that Tab reaches, in order: a positive `tabindex` first, then the others in order. */
export function tabbables(root: ParentNode = document.body): HTMLElement[] {
  const found = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !(element as HTMLButtonElement).disabled &&
      shown(element) &&
      !(element instanceof HTMLInputElement && element.type === 'hidden'),
  );
  const positive = found
    .filter((element) => element.tabIndex > 0)
    .toSorted((a, b) => a.tabIndex - b.tabIndex);
  return [...positive, ...found.filter((element) => element.tabIndex === 0)];
}

/** Moves focus as Tab does, or as Shift+Tab does, and returns the element that has it. */
export function tab(options: { shift?: boolean } = {}): HTMLElement | undefined {
  const order = tabbables();
  const at = order.indexOf(document.activeElement as HTMLElement);
  const next = options.shift
    ? order[at <= 0 ? order.length - 1 : at - 1]
    : order[at + 1 >= order.length ? 0 : at + 1];
  const target = document.activeElement as HTMLElement | null;
  target?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: options.shift, bubbles: true }),
  );
  next?.focus();
  return next;
}

/** Presses a key on an element, or on the element that has focus: `keydown`, then `keyup`. */
export function press(
  key: string,
  target: Element | null = document.activeElement,
  init: KeyboardEventInit = {},
): void {
  if (!target) {
    throw new Error(`Nothing has focus to press ${key} on`);
  }
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
  target.dispatchEvent(
    new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true, ...init }),
  );
}

/** Sends a pointer event to an element, from a mouse by default, with the first button. */
export function pointer(type: string, target: Element, init: PointerEventInit = {}): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      isPrimary: true,
      bubbles: !/^pointer(enter|leave)$/.test(type),
      cancelable: true,
      composed: true,
      ...init,
    }),
  );
}

/**
 * Presses an element with a pointer, as a browser sends it: pointerdown, pointerup, then a click
 * with a `detail` of 1. A touch or a pen comes with `pointerType`.
 */
export function pressWith(target: Element, init: PointerEventInit = {}): void {
  pointer('pointerdown', target, init);
  pointer('pointerup', target, init);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
}
