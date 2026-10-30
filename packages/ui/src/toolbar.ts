// Focus that the arrow keys move between the items of a toolbar.
// Tab stops at one item of the toolbar: the one that had focus last. A common way is to move
// focus to the edge of the toolbar just before Tab moves it on, which needs a handler that runs
// during the event. brumate runs handlers after it, so the other items leave the order of Tab
// instead, as the roving tabindex of WAI-ARIA does.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * True for a toolbar inside another one, such as a ToggleButtonGroup in a Toolbar. The outer one
 * moves focus between the items of both, so the inner one does nothing.
 */
export function isNested(toolbar: Element): boolean {
  return toolbar.parentElement?.closest('[role=toolbar]') != null;
}

/** The items of a toolbar that can take focus, in order, also those of a nested group. */
export function toolbarItems(toolbar: Element): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const item of toolbar.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (
      !item.closest('[hidden], [inert]') &&
      !item.matches(':disabled') &&
      item.getAttribute('aria-disabled') !== 'true'
    ) {
      found.push(item);
    }
  }
  return found;
}

/** True for the keys that move the caret of a field, which a toolbar leaves to it. */
function movesCaret(element: Element, key: string): boolean {
  if (element.tagName === 'TEXTAREA') {
    return true;
  }
  const field =
    element.tagName === 'INPUT' &&
    !/^(button|checkbox|radio|submit|reset|image|range|color|file)$/.test(
      (element as HTMLInputElement).type,
    );
  return field && key !== 'ArrowUp' && key !== 'ArrowDown';
}

/** Keeps only `current` in the order of Tab. */
export function rove(toolbar: Element, current: Element): void {
  if (isNested(toolbar)) {
    return;
  }
  for (const item of toolbarItems(toolbar)) {
    item.tabIndex = item === current ? 0 : -1;
  }
}

/**
 * Moves focus for a key: the next or the previous item, or the first or the last. Returns the
 * item that got focus, or undefined for a key that moves nothing.
 */
export function moveFocus(
  toolbar: Element,
  key: string,
  orientation: 'horizontal' | 'vertical',
  direction: 'ltr' | 'rtl',
): HTMLElement | undefined {
  if (isNested(toolbar)) {
    return undefined;
  }
  const items = toolbarItems(toolbar);
  const at = items.indexOf(document.activeElement as HTMLElement);
  // A text field keeps the keys that move its caret.
  if (at === -1 || movesCaret(items[at]!, key)) {
    return undefined;
  }
  // Right to left, the arrow keys of a horizontal toolbar turn around.
  let forward = 'ArrowDown';
  let backward = 'ArrowUp';
  if (orientation === 'horizontal') {
    forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  }
  let next: HTMLElement | undefined;
  if (key === forward) {
    next = items[Math.min(at + 1, items.length - 1)];
  } else if (key === backward) {
    next = items[Math.max(at - 1, 0)];
  } else if (key === 'Home') {
    next = items[0];
  } else if (key === 'End') {
    next = items.at(-1);
  }
  if (next && next !== items[at]) {
    rove(toolbar, next);
    next.focus();
  }
  return next;
}

/**
 * Prevents the default of Home and End, and of Up and Down in a vertical toolbar, while the
 * toolbar moves focus with them, so the page does not scroll. A text field keeps the keys that
 * move its caret, and a text area keeps all of them. The check needs the focused item, so it
 * cannot be a fixed key list of the handler. Returns a function that stops.
 */
export function preventEdges(toolbar: Element): () => void {
  function listener(event: Event): void {
    const { key, ctrlKey, metaKey, altKey } = event as KeyboardEvent;
    const vertical = toolbar.getAttribute('data-orientation') === 'vertical';
    const arrow = vertical && (key === 'ArrowUp' || key === 'ArrowDown');
    if ((key !== 'Home' && key !== 'End' && !arrow) || ctrlKey || metaKey || altKey) {
      return;
    }
    if (isNested(toolbar)) {
      return;
    }
    const active = document.activeElement;
    if (
      active &&
      toolbarItems(toolbar).includes(active as HTMLElement) &&
      !movesCaret(active, key)
    ) {
      event.preventDefault();
    }
  }
  toolbar.addEventListener('keydown', listener);
  return () => toolbar.removeEventListener('keydown', listener);
}

/**
 * Keeps one item in the order of Tab while the items change. An item that held it can become
 * disabled or leave the toolbar, such as a button that a press disables, and then Tab would skip
 * the toolbar. Returns a function that stops.
 */
export function keepTabStop(toolbar: Element): () => void {
  function check(): void {
    if (isNested(toolbar)) {
      return;
    }
    const items = toolbarItems(toolbar);
    // Before the first focus, every item is in the order of Tab.
    let started = false;
    for (const item of items) {
      if (item.hasAttribute('tabindex')) {
        started = true;
        break;
      }
    }
    if (!started) {
      return;
    }
    let stop = items[0];
    for (const item of items) {
      if (item.tabIndex === 0) {
        stop = item;
        break;
      }
    }
    if (stop) {
      rove(toolbar, stop);
    }
  }
  const observer = new MutationObserver(check);
  observer.observe(toolbar, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-disabled', 'hidden', 'inert'],
  });
  return () => observer.disconnect();
}
