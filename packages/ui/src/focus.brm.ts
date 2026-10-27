// Focus handling for the parts. The focus shows as a ring when
// the browser's :focus-visible says so, such as after Tab, and when a key is pressed after a
// pointer moved focus. CSS can use :focus-visible directly. The data attributes are for parts
// whose ring is on another element.
import { $signal } from 'brumate/signals';
import { MODIFIERS, isFocusVisible, shortcut } from './interactions.ts';

/**
 * Focus handling for an element. Returns whether it has focus, whether the focus shows, and a
 * function for each event.
 */
export function focusRing(
  onFocus: ((event: FocusEvent) => void) | undefined,
  onBlur: ((event: FocusEvent) => void) | undefined,
  onFocusChange: ((focused: boolean) => void) | undefined,
) {
  let focused = $signal(false);
  let focusVisible = $signal(false);

  function focus(event: FocusEvent) {
    const target = event.currentTarget as Element;
    // Handlers run after the event, so focus can have moved on.
    if (document.activeElement !== target) {
      return;
    }
    focused = true;
    focusVisible = isFocusVisible(target);
    onFocus?.(event);
    onFocusChange?.(true);
  }

  function blur(event: FocusEvent) {
    if (!focused) {
      return;
    }
    focused = false;
    focusVisible = false;
    onBlur?.(event);
    onFocusChange?.(false);
  }

  function keyDown(event: KeyboardEvent) {
    if (focused && !MODIFIERS.has(event.key) && !shortcut(event)) {
      focusVisible = true;
    }
  }

  function pointerDown() {
    focusVisible = false;
  }

  return {
    focused,
    focusVisible,
    onFocus: focus,
    onBlur: blur,
    onKeyDown: keyDown,
    onPointerDown: pointerDown,
  };
}
