// The state that a part with a thumb of color shares with its ColorThumb, after the thumb of
// React Aria Components. ColorSlider, ColorArea and ColorWheel each hold one or two ColorThumbs.
//
// How a part uses it:
//
// 1. The part computes everything about the thumb: its color, where it sits, what its inputs read,
//    and what is happening to it. It provides that as a `ColorThumbState` in `ColorThumbContext`.
// 2. The ColorThumb draws it. It sets `--color` and the background from `color`, places itself at
//    `left` and `top`, renders the `inputs`, and shows the states as `data-*` attributes.
// 3. The ColorThumb tells the part when the thumb is pressed, focused or changed. The part
//    decides what that means: a slider moves one channel, and an area moves two.
//
// The ColorThumb is the same for all of them, so it knows nothing of channels, tracks or wheels.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/**
 * A hidden `<input type="range">` of a thumb. It gives a screen reader the value, and the keys
 * their steps. A slider or a wheel gives the thumb one, and an area gives it two: x, then y. It
 * holds data only: what the user does to it goes to `onInputChange` and `onInputPage` of the
 * state, with its index, since page state can hold a function there but not inside a list.
 */
export interface ColorThumbInput {
  /** The ID of the input. A reset of a form and the SliderOutput find it by this. */
  id: string;
  /** The name that a form posts the value with. */
  name?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** The value as text, for `aria-valuetext`, such as `120°, green`. */
  valueText: string;
  /** The name for `aria-label`. */
  label?: string;
  /** The IDs of the elements that name it, for `aria-labelledby`. It wins over `label`. */
  labelledBy?: string;
  orientation?: 'horizontal' | 'vertical';
  /**
   * The part takes all the keys of this input: the arrows, PageUp, PageDown, Home and End go to
   * `onInputKey`, and the range input does not move. An area needs it, since Up on the input of
   * x moves y. Without it, the arrows and Home and End move the input as a range input does.
   */
  keys?: boolean;
  /** The role description of the input, such as `2D slider` for an area. */
  roleDescription?: string;
}

/** What a part tells a ColorThumb. */
export interface ColorThumbState {
  /** The color that the thumb shows, as a color of CSS. It sets `--color` and the background. */
  color: string;
  /**
   * Where the center of the thumb is on its parent, as percents of the parent from its left and
   * top edges, from 0 to 100. The part computes them, and flips them for a track that grows
   * upward, or right to left. The thumb is positioned `absolute` in the parent, which must be
   * positioned too.
   */
  left: number;
  top: number;
  /** The inputs to render, in order. */
  inputs: ColorThumbInput[];
  /** A drag moves the thumb, which shows `data-dragging`. */
  isDragging: boolean;
  /** An input of the thumb has the focus, and whether `:focus-visible` matches it. */
  isFocused: boolean;
  isFocusVisible: boolean;
  /** The thumb is still: its inputs are disabled, and it shows `data-disabled`. */
  isDisabled: boolean;
  /**
   * An input got a value, from the keys or a screen reader. `index` is the position of the input
   * in `inputs`. Not called while the thumb is disabled.
   */
  onInputChange: (index: number, value: number) => void;
  /** PageUp (`1`) or PageDown (`-1`) was pressed on an input. The range input has no page. */
  onInputPage: (index: number, direction: 1 | -1) => void;
  /**
   * A key was pressed on an input that has `keys`: `key` is an arrow, `PageUp`, `PageDown`, `Home`
   * or `End`, and `shiftKey` tells whether Shift was down. Not called while the thumb is disabled.
   */
  onInputKey?: (index: number, key: string, shiftKey: boolean) => void;
  /**
   * The primary pointer went down on the thumb. The part focuses the first input and starts the
   * drag. It keeps the distance from the pointer to the center of the thumb, so the thumb does
   * not jump to the pointer, as a SliderThumb does. Not called while the thumb is disabled.
   */
  onPress: (event: PointerEvent) => void;
  /** An input got or lost the focus. The part keeps `isFocused` and `isFocusVisible`. */
  onFocusChange: (focused: boolean, focusVisible: boolean) => void;
  /**
   * A key other than PageUp and PageDown went down on an input. Optional: a part that needs a key
   * that the range input does not handle, such as a wheel that wraps at 0, takes it here.
   */
  onInputKeyDown?: (index: number, event: KeyboardEvent) => void;
  /** The change of an input ended: the user let go of the key or the value was committed. */
  onChangeEnd: () => void;
  /** `rtl` for the direction of the locale, which the inputs use. */
  direction: 'ltr' | 'rtl';
}

export const ColorThumbContext: Context<ColorThumbState | null> =
  createContext<ColorThumbState | null>('brumate-ui:color-thumb', null);
