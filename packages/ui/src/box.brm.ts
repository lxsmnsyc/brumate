// Hover, press and focus of the label of a box, such as a Checkbox, a Switch or a Radio. The
// native input inside the label toggles on a click and on Space by itself, so these handlers
// only show the state. Its focus is on the input, which focusin and focusout bring to the label.
import { $signal } from 'brumate/signals';
import { isFocusVisible } from './interactions.ts';

/** The state of the label of a box, and a function for each event of the label. */
export function box(disabled: boolean) {
  let hovered = $signal(false);
  let pressed = $signal(false);
  let focused = $signal(false);
  let focusVisible = $signal(false);

  function pointerEnter(event: PointerEvent) {
    if (!disabled && event.pointerType !== 'touch') {
      hovered = true;
    }
  }

  function pointerLeave() {
    hovered = false;
    pressed = false;
  }

  function pointerDown(event: PointerEvent) {
    if (!disabled && event.button === 0) {
      pressed = true;
      focusVisible = false;
    }
  }

  function pointerUp() {
    pressed = false;
  }

  function pointerCancel() {
    pressed = false;
  }

  function keyDown(event: KeyboardEvent) {
    if (!disabled && event.key === ' ' && !event.repeat) {
      pressed = true;
    }
    if (focused) {
      focusVisible = true;
    }
  }

  function keyUp(event: KeyboardEvent) {
    if (event.key === ' ') {
      pressed = false;
    }
  }

  function focusIn(event: FocusEvent) {
    const label = event.currentTarget as Element;
    const target = document.activeElement;
    // Handlers run after the event, so focus can have moved on.
    if (!target || !label.contains(target)) {
      return;
    }
    focused = true;
    focusVisible = isFocusVisible(target);
  }

  function focusOut(event: FocusEvent) {
    const label = event.currentTarget as Element;
    if (document.activeElement && label.contains(document.activeElement)) {
      return;
    }
    focused = false;
    focusVisible = false;
  }

  return {
    hovered,
    pressed,
    focused,
    focusVisible,
    onPointerEnter: pointerEnter,
    onPointerLeave: pointerLeave,
    onPointerDown: pointerDown,
    onPointerUp: pointerUp,
    onPointerCancel: pointerCancel,
    onKeyDown: keyDown,
    onKeyUp: keyUp,
    onFocusIn: focusIn,
    onFocusOut: focusOut,
  };
}
