// Plain helpers of press, hover and focus handling, which the modules of the parts call.
import type { PointerKind, PressEvent } from './events.ts';

/**
 * True for the keys that press an element: Enter, and Space for what is not a link. A link has
 * the role `link`, or is an `<a href>` without a role, as React Aria counts it.
 */
export function isPressKey(event: KeyboardEvent, element: Element): boolean {
  if (event.key === 'Enter') {
    return true;
  }
  return (event.key === ' ' || event.code === 'Space') && !isLink(element);
}

/** True for an element that is a link to assistive technology. */
export function isLink(element: Element): boolean {
  const role = element.getAttribute('role');
  return role === 'link' || (!role && isAnchor(element));
}

/** True for an `<a>` with an `href`, which the browser follows on a click. */
export function isAnchor(element: Element): boolean {
  return element.tagName === 'A' && element.hasAttribute('href');
}

/** True for a button or a button input, which the browser clicks on Space when it may. */
export function isNativeButton(element: Element): boolean {
  return (
    element.tagName === 'BUTTON' ||
    (element.tagName === 'INPUT' &&
      /^(button|submit|reset|image)$/.test((element as HTMLInputElement).type))
  );
}

/** True for an element that the browser clicks on Enter: a link or a button. */
export function clicksOnEnter(element: Element): boolean {
  return isAnchor(element) || isNativeButton(element);
}

/** True when a point of a pointer is over the element, as React Aria counts it. */
export function isOver(event: PointerEvent, element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const width = (event.width || 0) / 2;
  const height = (event.height || 0) / 2;
  return (
    event.clientX + width >= rect.left &&
    event.clientX - width <= rect.right &&
    event.clientY + height >= rect.top &&
    event.clientY - height <= rect.bottom
  );
}

/** Makes the event that the press handlers get. */
export function pressEvent(
  type: PressEvent['type'],
  pointerType: PointerKind,
  target: Element,
  event: Event,
): PressEvent {
  const keys = event as KeyboardEvent;
  return {
    type,
    pointerType,
    target,
    shiftKey: Boolean(keys.shiftKey),
    ctrlKey: Boolean(keys.ctrlKey),
    metaKey: Boolean(keys.metaKey),
    altKey: Boolean(keys.altKey),
    x: (event as PointerEvent).clientX ?? 0,
    y: (event as PointerEvent).clientY ?? 0,
    pointerId: (event as PointerEvent).pointerId,
  };
}

/** Keys that change no focus ring: they only change other keys. */
export const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

/**
 * True for a key with Meta or Control, or with Alt off a Mac: a shortcut, which shows no focus
 * ring, as isValidKey of React Aria.
 */
export function shortcut(event: KeyboardEvent): boolean {
  const mac = /^Mac/i.test(globalThis.navigator?.platform ?? '');
  return event.metaKey || event.ctrlKey || (!mac && event.altKey);
}

/** True when the browser would show a focus ring on the element. */
export function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}
