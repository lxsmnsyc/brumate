// The state that a Slider shares with its output, its track and its thumbs, and the drag of a
// thumb.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';
import { clamp, snapToStep } from './numbers.ts';

export interface SliderState {
  values: number[];
  minValue: number;
  maxValue: number;
  step: number;
  /** The step of PageUp and PageDown: a tenth of the range, on a step. */
  pageSize: number;
  orientation: 'horizontal' | 'vertical';
  isDisabled: boolean;
  /** The ID that the IDs of the thumbs start with, and the IDs of the label and the output. */
  id: string;
  labelId: string;
  /** The values in the format of the locale, such as `20 – 80`. */
  label: string;
  /** The value of each thumb in the format of the locale, for `aria-valuetext`. */
  labels: string[];
  /** The thumbs that a drag moves now, which show `data-dragging`. */
  dragging: number[];
  setThumb: (index: number, value: number) => void;
  /** A drag of the thumb started or ended. `onChangeEnd` follows the end. */
  setDragging: (index: number, dragging: boolean) => void;
}

export const SliderContext: Context<SliderState | null> = createContext<SliderState | null>(
  'brumate-ui:slider',
  null,
);

/** The ID of the input of a thumb. */
export function thumbId(slider: { id: string }, index: number): string {
  return `${slider.id}-thumb-${index}`;
}

/** The lowest and the highest value of a thumb: those of the thumbs next to it, or the range. */
export function thumbRange(slider: SliderState, index: number): [number, number] {
  return [
    index === 0 ? slider.minValue : slider.values[index - 1]!,
    index === slider.values.length - 1 ? slider.maxValue : slider.values[index + 1]!,
  ];
}

/** Where a value is on the track, from 0 to 1. */
export function getPercent(slider: SliderState, value: number): number {
  const size = slider.maxValue - slider.minValue;
  return size > 0 ? clamp((value - slider.minValue) / size, 0, 1) : 0;
}

/** Where a point is on the track, from 0 to 1, or past the ends. */
export function pointAt(
  slider: SliderState,
  track: Element,
  x: number,
  y: number,
  rtl: boolean,
): number {
  const box = track.getBoundingClientRect();
  const vertical = slider.orientation === 'vertical';
  const size = vertical ? box.height : box.width;
  const percent = size > 0 ? (vertical ? y - box.top : x - box.left) / size : 0;
  // A vertical track grows upward, and a horizontal one right to left grows to the left.
  return vertical || rtl ? 1 - percent : percent;
}

/**
 * The value on a step at a point of the track, as the pointer gives it. `offset` is where the
 * pointer was on a thumb when its drag began, so the thumb does not jump to the pointer.
 */
export function valueAt(
  slider: SliderState,
  track: Element,
  x: number,
  y: number,
  rtl: boolean,
  offset = 0,
): number {
  const percent = pointAt(slider, track, x, y, rtl) - offset;
  const value = slider.minValue + clamp(percent, 0, 1) * (slider.maxValue - slider.minValue);
  return snapToStep(value, slider.minValue, slider.maxValue, slider.step);
}

/**
 * The thumb that a press on the track moves: the nearest one, or the one after it when two are
 * on top of each other.
 */
export function closestThumb(values: number[], value: number): number {
  let split = -1;
  for (const [index, item] of values.entries()) {
    if (value - item < 0) {
      split = index;
      break;
    }
  }
  if (split === 0) {
    return 0;
  }
  if (split === -1) {
    return values.length - 1;
  }
  return Math.abs(values[split - 1]! - value) < Math.abs(values[split]! - value)
    ? split - 1
    : split;
}

// A thumb follows the pointer with the drag of `drag.ts`, which a ColumnResizer uses too.
export { startDrag } from './drag.ts';
