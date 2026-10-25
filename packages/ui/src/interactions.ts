// Plain helpers of press, hover and focus handling, which the modules of the parts call.
import type { PointerKind, PressEvent } from './events.ts';

/** True for the keys that press an element: Enter, and Space for what is not a link. */
export function isPressKey(event: KeyboardEvent, element: Element): boolean {
  if (event.key === 'Enter') {
    return true;
  }
  return (event.key === ' ' || event.code === 'Space') && !isLink(element);
}

export function isLink(element: Element): boolean {
  return element.tagName === 'A' && element.hasAttribute('href');
}

/** True for an element that the browser clicks on Enter: a link, a button, or a button input. */
export function clicksOnEnter(element: Element): boolean {
  if (isLink(element) || element.tagName === 'BUTTON') {
    return true;
  }
  return (
    element.tagName === 'INPUT' &&
    /^(button|submit|reset|image)$/.test((element as HTMLInputElement).type)
  );
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
  };
}

/** Keys that change no focus ring: they only change other keys. */
export const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

/** True when the browser would show a focus ring on the element. */
export function isFocusVisible(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}
