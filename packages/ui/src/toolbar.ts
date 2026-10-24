// Focus that the arrow keys move between the items of a toolbar, as useToolbar of React Aria
// does. Tab stops at one item of the toolbar: the one that had focus last. React Aria moves
// focus to the edge of the toolbar just before Tab moves it on, which needs a handler that runs
// during the event. brumate runs handlers after it, so the other items leave the order of Tab
// instead, as the roving tabindex of WAI-ARIA does.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * True for a toolbar inside another one, such as a ToggleButtonGroup in a Toolbar. The outer one
 * moves focus between the items of both, as in React Aria, so the inner one does nothing.
 */
export function isNested(toolbar: Element): boolean {
  return toolbar.parentElement?.closest('[role=toolbar]') != null;
}

/** The items of a toolbar that can take focus, in order, also those of a nested group. */
export function toolbarItems(toolbar: Element): HTMLElement[] {
  return [...toolbar.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (item) => !item.closest('[hidden], [inert]') && item.getAttribute('aria-disabled') !== 'true',
  );
}

function isTextField(element: Element): boolean {
  return (
    element.tagName === 'TEXTAREA' ||
    (element.tagName === 'INPUT' &&
      !/^(button|checkbox|radio|submit|reset|image|range|color|file)$/.test(
        (element as HTMLInputElement).type,
      ))
  );
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
  if (at === -1 || (isTextField(items[at]!) && key !== 'ArrowUp' && key !== 'ArrowDown')) {
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
