// The state that a Slider shares with its output, its track and its thumbs, and the drag of a
// thumb, after the slider of React Aria.
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
  setThumb: (index: number, value: number) => void;
  /** A drag of the thumb started or ended, which `onChangeEnd` follows. */
  setDragging: (index: number, dragging: boolean) => void;
}

export const SliderContext: Context<SliderState | null> = createContext<SliderState | null>(
  'brumate-ui:slider',
  null,
);

/** The ID of the input of a thumb. */
export function thumbId(slider: SliderState, index: number): string {
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
export function percentOf(slider: SliderState, value: number): number {
  const size = slider.maxValue - slider.minValue;
  return size > 0 ? clamp((value - slider.minValue) / size, 0, 1) : 0;
}

/** The value on a step at a point of the track, as the pointer gives it. */
export function valueAt(
  slider: SliderState,
  track: Element,
  x: number,
  y: number,
  rtl: boolean,
): number {
  const box = track.getBoundingClientRect();
  const vertical = slider.orientation === 'vertical';
  const size = vertical ? box.height : box.width;
  let percent = size > 0 ? (vertical ? y - box.top : x - box.left) / size : 0;
  // A vertical track grows upward, and a horizontal one right to left grows to the left.
  if (vertical || rtl) {
    percent = 1 - percent;
  }
  const value = slider.minValue + clamp(percent, 0, 1) * (slider.maxValue - slider.minValue);
  return snapToStep(value, slider.minValue, slider.maxValue, slider.step);
}

/**
 * The thumb that a press on the track moves: the nearest one, or the one after it when two are
 * on top of each other, as React Aria picks it.
 */
export function closestThumb(values: number[], value: number): number {
  const split = values.findIndex((item) => value - item < 0);
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

/** The drag of a thumb, which the window follows until the pointer goes up. */
let drag: { pointer: number; move: (event: PointerEvent) => void; end: () => void } | undefined;

function moved(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointer) {
    return;
  }
  // The code of a press loads on the first press, so the pointer can go up before the drag
  // listens. A move with no button down ends the drag.
  if (event.pointerType === 'mouse' && event.buttons === 0) {
    ended(event);
    return;
  }
  drag.move(event);
}

function ended(event: PointerEvent): void {
  if (drag && event.pointerId === drag.pointer) {
    const done = drag;
    stopDrag();
    done.end();
  }
}

function stopDrag(): void {
  drag = undefined;
  window.removeEventListener('pointermove', moved);
  window.removeEventListener('pointerup', ended);
  window.removeEventListener('pointercancel', ended);
}

/** Follows the pointer until it goes up, with listeners of the window that stay the same. */
export function startDrag(
  pointer: number,
  move: (event: PointerEvent) => void,
  end: () => void,
): void {
  stopDrag();
  drag = { pointer, move, end };
  window.addEventListener('pointermove', moved);
  window.addEventListener('pointerup', ended);
  window.addEventListener('pointercancel', ended);
}
