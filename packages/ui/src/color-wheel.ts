// The state that a ColorWheel shares with its ColorWheelTrack, and the math of the circle. The
// thumb is a ColorThumb, which the wheel feeds through `ColorThumbContext`.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** What a ColorWheel tells its ColorWheelTrack. */
export interface ColorWheelState {
  /** The radii of the ring in pixels. The track is a circle of twice the outer radius. */
  outerRadius: number;
  innerRadius: number;
  isDisabled: boolean;
  /** The pointer went down on the track. The wheel moves the hue if it is on the ring. */
  onTrackPress: (event: PointerEvent) => void;
}

export const ColorWheelContext: Context<ColorWheelState | null> =
  createContext<ColorWheelState | null>('brumate-ui:color-wheel', null);

/** A hue is kept in 0 to 359, and rounded to the step. A hue past 360 starts over at 0. */
export function wrapHue(hue: number, step: number): number {
  if (hue > 360) {
    return 0;
  }
  const mod = ((hue % 360) + 360) % 360;
  return (Math.round(mod / step) * step) % 360;
}

/**
 * The offset of a point from the center of the wheel, for a hue and a radius. 0 degrees is at 3
 * o'clock and the hue grows clockwise, with y down the page.
 */
export function hueToPoint(hue: number, radius: number): { x: number; y: number } {
  const angle = (hue * Math.PI) / 180;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** The hue of an offset from the center of the wheel. */
export function pointToHue(x: number, y: number): number {
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** The hue after a step up, wrapping at the end of the circle, to a multiple of the step. */
export function hueUp(hue: number, size: number, step: number): number {
  const s = Math.max(size, step);
  let next = hue + s;
  if (next >= 360) {
    next = 0;
  }
  return wrapHue(Math.round((next % 360) / s) * s, step);
}

/** The hue after a step down. From 0 it goes to the last multiple of the step below 360. */
export function hueDown(hue: number, size: number, step: number): number {
  const s = Math.max(size, step);
  if (hue === 0) {
    const last = Math.floor(360 / s);
    return (last * s === 360 ? last - 1 : last) * s;
  }
  return wrapHue(Math.round(((((hue - s) % 360) + 360) % 360) / s) * s, step);
}
