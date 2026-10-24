// Press handling for the parts, after usePress of React Aria. A press starts with a pointer, Enter
// or Space, or a click without a pointer, such as from a screen reader, and calls the same
// handlers for each. A part calls the returned functions from the handlers of its element, and
// shows `pressed` as `data-pressed`. Space must be prevented on keydown and keyup, with
// `prevent(handler, 'Space')`, so the browser does not scroll the page or click the element.
//
// The handlers load on the first event, after the browser has moved on. So a press keeps its
// pointer with pointer capture, and its pointerup reaches the element even when it ends outside.
// A listener on the document, as React Aria adds, would start too late to see it.
import { $signal } from 'brumate/signals';
import type { PointerKind, PressEvent } from './events.ts';
import { clicksOnEnter, isLink, isOver, isPressKey, pressEvent } from './interactions.ts';

/**
 * Press handling for an element. Returns whether it is pressed, and a function for each event of
 * the element. A disabled element starts no press.
 */
export function press(
  disabled: boolean | undefined,
  onPress: ((event: PressEvent) => void) | undefined,
  onPressStart: ((event: PressEvent) => void) | undefined,
  onPressEnd: ((event: PressEvent) => void) | undefined,
  onPressUp: ((event: PressEvent) => void) | undefined,
  onPressChange: ((pressed: boolean) => void) | undefined,
) {
  let pressed = $signal(false);
  // What started the press: a pointer, a key, or nothing.
  let pointer = $signal<number | undefined>(undefined);
  let pointerKind = $signal<PointerKind | undefined>(undefined);
  let key = $signal<string | undefined>(undefined);
  // The press is over the element, so it shows as pressed.
  let over = $signal(false);
  // A press by a pointer or a key ends with a click, which must not press again.
  let ignoreClick = $signal(false);

  function start(kind: PointerKind, target: Element, event: Event) {
    pointerKind = kind;
    over = true;
    if (!pressed) {
      pressed = true;
      onPressStart?.(pressEvent('pressstart', kind, target, event));
      onPressChange?.(true);
    }
  }

  function end(target: Element, event: Event, released: boolean) {
    const kind = pointerKind ?? 'mouse';
    if (pressed) {
      pressed = false;
      onPressEnd?.(pressEvent('pressend', kind, target, event));
      onPressChange?.(false);
    }
    if (released) {
      onPress?.(pressEvent('press', kind, target, event));
    }
  }

  function pointerDown(event: PointerEvent) {
    const target = event.currentTarget as HTMLElement;
    if (disabled || event.button !== 0 || pointer !== undefined) {
      return;
    }
    pointer = event.pointerId;
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // The pointer is up already: its pointerup is queued after this handler.
    }
    // Safari does not focus a button that a pointer presses.
    if (target !== document.activeElement && target.tabIndex >= 0) {
      target.focus({ preventScroll: true });
    }
    start(event.pointerType as PointerKind, target, event);
  }

  function pointerMove(event: PointerEvent) {
    const target = event.currentTarget as Element;
    if (event.pointerId !== pointer) {
      return;
    }
    const inside = isOver(event, target);
    if (inside && !over) {
      start(pointerKind ?? 'mouse', target, event);
    } else if (!inside && over) {
      over = false;
      end(target, event, false);
    }
  }

  function pointerUp(event: PointerEvent) {
    const target = event.currentTarget as Element;
    if (event.pointerId !== pointer) {
      return;
    }
    const inside = over && isOver(event, target);
    if (inside) {
      onPressUp?.(pressEvent('pressup', pointerKind ?? 'mouse', target, event));
    }
    pointer = undefined;
    over = false;
    ignoreClick = true;
    end(target, event, inside);
  }

  function pointerCancel(event: PointerEvent) {
    if (event.pointerId !== pointer) {
      return;
    }
    pointer = undefined;
    over = false;
    end(event.currentTarget as Element, event, false);
  }

  function keyDown(event: KeyboardEvent) {
    const target = event.currentTarget as Element;
    if (disabled || event.repeat || key !== undefined || !isPressKey(event, target)) {
      return;
    }
    key = event.key;
    // The browser clicks it on Enter. The press ends on keyup, so that click must not press again.
    if (event.key === 'Enter' && clicksOnEnter(target)) {
      ignoreClick = true;
    }
    start('keyboard', target, event);
  }

  function keyUp(event: KeyboardEvent) {
    const target = event.currentTarget as HTMLElement;
    if (event.key !== key) {
      return;
    }
    key = undefined;
    onPressUp?.(pressEvent('pressup', 'keyboard', target, event));
    end(target, event, true);
    // Space follows a link, as Enter does.
    if (event.key === ' ' && isLink(target)) {
      ignoreClick = true;
      target.click();
    }
  }

  function click(event: MouseEvent) {
    const target = event.currentTarget as Element;
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    if (disabled) {
      return;
    }
    // A click with no pointer or key before it, such as from a screen reader or element.click().
    const kind: PointerKind = event.detail === 0 || pointer === undefined ? 'virtual' : 'mouse';
    start(kind, target, event);
    onPressUp?.(pressEvent('pressup', kind, target, event));
    end(target, event, true);
  }

  return {
    pressed,
    onPointerDown: pointerDown,
    onPointerMove: pointerMove,
    onPointerUp: pointerUp,
    onPointerCancel: pointerCancel,
    onKeyDown: keyDown,
    onKeyUp: keyUp,
    onClick: click,
  };
}
