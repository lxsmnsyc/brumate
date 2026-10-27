// The math of a NumberField and a Slider: steps that keep the precision of the step, values that
// snap to a step between a minimum and a maximum, and the repeat of a Button that is held.

/** The number of digits after the point in a number, also for one such as `1e-7`. */
function precisionOf(step: number): number {
  const text = String(step).toLowerCase();
  const exponent = text.indexOf('e-');
  if (exponent > 0) {
    return Math.abs(Math.floor(Math.log10(Math.abs(step)))) + exponent;
  }
  const point = text.indexOf('.');
  return point >= 0 ? text.length - point : 0;
}

/** Rounds a value to the precision of a step, so `0.1 + 0.2` is `0.3`. */
export function roundToStep(value: number, step: number): number {
  const precision = precisionOf(step);
  if (precision === 0) {
    return value;
  }
  const power = 10 ** precision;
  return Math.round(value * power) / power;
}

/** Adds or takes a step, with the precision of both numbers. */
export function addStep(value: number, step: number, sign: 1 | -1): number {
  const digits = Math.max(precisionOf(value), precisionOf(step));
  const power = 10 ** digits;
  return digits === 0
    ? value + sign * step
    : (Math.round(value * power) + sign * Math.round(step * power)) / power;
}

/** Keeps a value between a minimum and a maximum. */
export function clamp(value: number, min = -Infinity, max = Infinity): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Moves a value to the nearest step, counted from the minimum, and keeps it between the minimum
 * and the maximum, at the last step that fits.
 */
export function snapToStep(
  value: number,
  min: number | undefined,
  max: number | undefined,
  step: number,
): number {
  const base = min ?? 0;
  const remainder = (value - base) % step;
  let snapped = roundToStep(
    Math.abs(remainder) * 2 >= step
      ? value + Math.sign(remainder) * (step - Math.abs(remainder))
      : value - remainder,
    step,
  );
  if (min !== undefined && snapped < min) {
    snapped = min;
  } else if (max !== undefined && snapped > max) {
    snapped = base + Math.floor(roundToStep((max - base) / step, step)) * step;
  }
  return roundToStep(snapped, step);
}

/**
 * The value a step up or down from `value`, in the direction of the change. A value off the
 * steps first moves to the nearest step, when that is in the direction of the change. With no
 * value, it starts at the minimum or the maximum, or at 0.
 */
export function nextStep(
  value: number,
  sign: 1 | -1,
  min: number | undefined,
  max: number | undefined,
  step: number,
): number {
  if (Number.isNaN(value)) {
    const start = sign === 1 ? min : max;
    return snapToStep(start ?? 0, min, max, step);
  }
  const snapped = snapToStep(value, min, max, step);
  if ((sign === 1 && snapped > value) || (sign === -1 && snapped < value)) {
    return snapped;
  }
  return snapToStep(addStep(value, step, sign), min, max, step);
}

/** The repeat of a held Button, by the ID of its field. */
const repeats = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Runs `step` at once, and again while the Button is held: after `delay`, 400 milliseconds for a
 * mouse and 600 for a touch, and then every 60 milliseconds.
 */
export function startRepeat(id: string, step: () => boolean, delay: number): void {
  stopRepeat(id);
  if (!step()) {
    return;
  }
  const again = (wait: number): void => {
    repeats.set(
      id,
      setTimeout(() => {
        if (step()) {
          again(60);
        } else {
          repeats.delete(id);
        }
      }, wait),
    );
  };
  again(delay);
}

export function stopRepeat(id: string): void {
  clearTimeout(repeats.get(id));
  repeats.delete(id);
}

/** The wheel listener of each field that has focus, by the ID of its input, so blur removes it. */
const wheels = new Map<string, (event: WheelEvent) => void>();

/** Listens to the wheel on an input while it has focus. */
export function listenToWheel(
  input: HTMLInputElement,
  listener: (event: WheelEvent) => void,
): void {
  stopWheel(input);
  wheels.set(input.id, listener);
  input.addEventListener('wheel', listener, { passive: false });
}

export function stopWheel(input: HTMLInputElement): void {
  const listener = wheels.get(input.id);
  if (listener) {
    input.removeEventListener('wheel', listener);
    wheels.delete(input.id);
  }
}
