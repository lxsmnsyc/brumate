// What a MenuTrigger with `trigger="contextmenu"` needs from the page: where a menu opens for a
// key or a long press, a long press of a touch, and the menu of the browser kept away while it is open.
import { LONG_PRESS } from './preview.ts';

/** How far a touch may move during a long press, in pixels, before it is a scroll. */
const SLOP = 10;

/** A point of the viewport. */
export interface Point {
  x: number;
  y: number;
}

/** Where the last input on a trigger came from, by its ID: `true` for the keyboard. */
const keyboard = new Map<string, boolean>();

export function markInput(triggerId: string, fromKeyboard: boolean): void {
  keyboard.set(triggerId, fromKeyboard);
}

export function forgetInput(triggerId: string): void {
  keyboard.delete(triggerId);
}

export function usedKeyboard(triggerId: string): boolean {
  return keyboard.get(triggerId) ?? false;
}

/** The point for a menu that a key opens: under the start of the element that has focus. */
export function keyboardPoint(event: MouseEvent): Point {
  const active = document.activeElement;
  const from = active && active !== document.body ? active : event.target;
  if (!(from instanceof Element)) {
    return { x: event.clientX, y: event.clientY };
  }
  const rect = from.getBoundingClientRect();
  return { x: rect.left, y: rect.bottom };
}

interface Press {
  timer: ReturnType<typeof setTimeout>;
  x: number;
  y: number;
  pointerId: number;
}

function swallow(click: Event): void {
  click.preventDefault();
  click.stopPropagation();
}

/** The long presses that wait, by trigger. */
const presses = new Map<string, Press>();

/**
 * Starts a long press of a touch: after half a second the menu opens at the touch, unless the
 * touch moves more than a few pixels, lifts or is taken over. The click that follows a long
 * press is swallowed, so a link under the finger does not navigate.
 */
export function startLongPress(
  triggerId: string,
  event: PointerEvent,
  open: (point: Point) => void,
): void {
  cancelLongPress(triggerId);
  const press: Press = {
    x: event.clientX,
    y: event.clientY,
    pointerId: event.pointerId,
    timer: setTimeout(() => {
      presses.delete(triggerId);
      open({ x: press.x, y: press.y });
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, true), 1000);
    }, LONG_PRESS),
  };
  presses.set(triggerId, press);
}

/** Cancels the wait of a long press. A move of a few pixels does not cancel it. */
export function cancelLongPress(triggerId: string, event?: PointerEvent): void {
  const press = presses.get(triggerId);
  if (!press) {
    return;
  }
  if (
    event &&
    (event.pointerId !== press.pointerId ||
      (event.type === 'pointermove' &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) <= SLOP))
  ) {
    return;
  }
  clearTimeout(press.timer);
  presses.delete(triggerId);
}

/**
 * While a context menu is open, the menu of the browser stays away: a right click or a key
 * inside the menu does nothing. A right click outside moves the menu: it closes, and `again`
 * gets the point so the menu opens there when the point is on the area. A scroll of the page
 * closes it, as a menu of the system does, since the point it was opened at has moved.
 * Returns the function that stops.
 */
export function keepBrowserMenuAway(
  overlayId: string,
  close: () => void,
  again: (point: Point) => void,
): () => void {
  function inside(target: EventTarget | null): boolean {
    const layer = document.getElementById(overlayId)?.closest('[data-layer]');
    return target instanceof Node && Boolean(layer?.contains(target));
  }
  function menu(event: MouseEvent): void {
    event.preventDefault();
    if (!inside(event.target)) {
      close();
      again({ x: event.clientX, y: event.clientY });
    }
  }
  // A scroll that was already on its way when the menu opened sends its event after it, with the
  // position that the menu opened at, so the page counts as scrolled only when it has moved.
  const startX = window.scrollX;
  const startY = window.scrollY;
  const started = performance.now();
  function scroll(event: Event): void {
    // The menu may scroll itself, and so may an element inside it.
    if (inside(event.target)) {
      return;
    }
    const page = event.target === document || event.target === document.documentElement;
    if (
      page
        ? window.scrollX !== startX || window.scrollY !== startY
        : performance.now() - started > 100
    ) {
      close();
    }
  }
  document.addEventListener('contextmenu', menu, true);
  document.addEventListener('scroll', scroll, { capture: true, passive: true });
  return () => {
    document.removeEventListener('contextmenu', menu, true);
    document.removeEventListener('scroll', scroll, true);
  };
}

/** How many frames a moved menu waits for the page to be usable again, to find the area under the point. */
const MOVE_FRAMES = 30;

/**
 * Calls `open` with the point once the area holds the element under it. The page is inert while
 * the menu closes, so the element under the point is the area only after the menu has left.
 */
export function openOnceFree(area: () => Element | null, point: Point, open: () => void): void {
  let frames = 0;
  function check(): void {
    const element = document.elementFromPoint(point.x, point.y);
    if (element && area()?.contains(element)) {
      open();
    } else if (++frames < MOVE_FRAMES) {
      requestAnimationFrame(check);
    }
  }
  requestAnimationFrame(check);
}

let warned = false;

/** Warns once in development about a context menu that nothing names. */
export function warnUnnamedMenu(): void {
  // The bundler sets `import.meta.env`, which the types of this package do not have.
  const env = (import.meta as { env?: { DEV?: boolean } }).env;
  if (warned || !env?.DEV) {
    return;
  }
  warned = true;
  console.warn(
    'A Menu of a MenuTrigger with trigger="contextmenu" has no aria-label or aria-labelledby, so it has no name. A context menu has no Button to name it.',
  );
}
