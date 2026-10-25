// Press, hover and focus of one element, which buttons and links share. It returns their state,
// and one function for each event of the element, which calls each module that needs the event.
import { focusRing } from './focus.brm.ts';
import { hover } from './hover.brm.ts';
import { press } from './press.brm.ts';
import type { HoverEvent, PressEvent } from './events.ts';

/** Press, hover and focus for an element. A disabled element presses and hovers never. */
export function interact(
  disabled: boolean,
  pressDisabled: boolean,
  onPress: (event: PressEvent) => void,
  onPressStart: (event: PressEvent) => void,
  onPressEnd: (event: PressEvent) => void,
  onPressUp: (event: PressEvent) => void,
  onPressChange: (pressed: boolean) => void,
  onHoverStart: (event: HoverEvent) => void,
  onHoverEnd: (event: HoverEvent) => void,
  onHoverChange: (hovered: boolean) => void,
  onFocusChange: (focused: boolean) => void,
) {
  const {
    pressed,
    onPointerDown: pressPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onKeyDown: pressKeyDown,
    onKeyUp,
    onClick,
    onBlur: pressBlur,
  } = press(pressDisabled, onPress, onPressStart, onPressEnd, onPressUp, onPressChange);
  const { hovered, onPointerEnter, onPointerLeave } = hover(
    disabled,
    onHoverStart,
    onHoverEnd,
    onHoverChange,
  );
  const {
    focused,
    focusVisible,
    onFocus,
    onBlur: ringBlur,
    onKeyDown: ringKeyDown,
    onPointerDown: ringPointerDown,
  } = focusRing(undefined, undefined, onFocusChange);

  function pointerDown(event: PointerEvent) {
    ringPointerDown();
    pressPointerDown(event);
  }

  function keyDown(event: KeyboardEvent) {
    ringKeyDown(event);
    pressKeyDown(event);
  }

  function blur(event: FocusEvent) {
    pressBlur(event);
    ringBlur(event);
  }

  return {
    pressed,
    hovered,
    focused,
    focusVisible,
    onPointerDown: pointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onPointerEnter,
    onPointerLeave,
    onKeyDown: keyDown,
    onKeyUp,
    onClick,
    onFocus,
    onBlur: blur,
  };
}
