// The timing of Transition: frames, and the end of a CSS transition or animation.

/** Calls `callback` after two frames, so the browser draws the first frame of a transition. */
export function afterFrames(callback: () => void): void {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}

/** The longest duration and delay of a list of times such as `0.2s, 150ms`, in milliseconds. */
function longest(durations: string, delays: string): number {
  const read = (list: string): number[] =>
    list.split(',').map((item) => {
      const value = Number.parseFloat(item);
      // A time that the browser does not give is no time.
      if (Number.isNaN(value)) {
        return 0;
      }
      return item.trim().endsWith('ms') ? value : value * 1000;
    });
  const times = read(durations);
  const waits = read(delays);
  return Math.max(0, ...times.map((time, index) => time + (waits[index % waits.length] ?? 0)));
}

/**
 * Calls `done` when the transition or the animation of the element ends: on its last
 * transitionend or animationend, or after its duration, in case no event comes. An element
 * with no transition, or a reader that asks for reduced motion, calls it at once.
 */
export function waitForTransition(element: HTMLElement | undefined, done: () => void): void {
  if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    done();
    return;
  }
  const style = getComputedStyle(element);
  const duration = Math.max(
    longest(style.transitionDuration, style.transitionDelay),
    longest(style.animationDuration, style.animationDelay),
  );
  if (duration === 0) {
    done();
    return;
  }
  let finished = false;
  const finish = (event?: Event): void => {
    // A transition of an element inside it ends on its own.
    if (finished || (event && event.target !== element)) {
      return;
    }
    finished = true;
    clearTimeout(timer);
    element.removeEventListener('transitionend', finish);
    element.removeEventListener('animationend', finish);
    done();
  };
  element.addEventListener('transitionend', finish);
  element.addEventListener('animationend', finish);
  const timer = setTimeout(finish, duration + 50);
}
