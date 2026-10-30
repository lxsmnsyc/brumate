// The timing of tooltips and previews, and the
// context of a TooltipTrigger.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** What a TooltipTrigger gives its Tooltip. */
export interface TooltipTriggerState {
  isOpen: boolean;
  triggerId: string;
  tooltipId: string;
  /** Keeps it open, while the pointer is over the tooltip. */
  keep: () => void;
  /** Closes it, after the close delay unless `immediate`. */
  close: (immediate: boolean) => void;
}

export const TooltipTriggerContext: Context<TooltipTriggerState | null> =
  createContext<TooltipTriggerState | null>('brumate-ui:tooltip-trigger', null);

/** How long the others show at once after one hides, in milliseconds. */
const COOLDOWN = 500;

/** Shows and hides the overlays of a kind, such as tooltips or previews. */
export interface Timing {
  /**
   * Shows an overlay: at once when `immediate`, or when another one of its kind showed a moment
   * ago, or else after `delay`. `show` returns false when the overlay did not open, such as when
   * a setter refused, so the next hover or focus asks again.
   */
  show: (
    id: string,
    delay: number,
    immediate: boolean,
    show: () => boolean | void,
    hide: () => void,
  ) => void;
  /** Hides an overlay: at once when `immediate`, or else after `closeDelay`. */
  hide: (id: string, closeDelay: number, immediate: boolean, hide: () => void) => void;
  /** Cancels the hide of an overlay that waits for its close delay. */
  keep: (id: string) => void;
  /**
   * Forgets an overlay whose trigger left the page: its timers stop, and an overlay that showed
   * starts the cooldown, as if it hid.
   */
  forget: (id: string) => void;
}

/**
 * The timing of a kind of overlay. Once one has shown,
 * the others show at once, until none has shown for a moment. One shows at a time.
 */
export function timing(): Timing {
  let warmedUp = false;
  let cooldown: ReturnType<typeof setTimeout> | undefined;
  /** The overlay that shows, and the function that hides it. */
  let current: { id: string; hide: () => void } | undefined;
  /** The timers of each overlay, by its ID. */
  const timers = new Map<
    string,
    { warm?: ReturnType<typeof setTimeout>; close?: ReturnType<typeof setTimeout> }
  >();

  function timersOf(id: string) {
    let found = timers.get(id);
    if (!found) {
      found = {};
      timers.set(id, found);
    }
    return found;
  }

  function reveal(id: string, show: () => boolean | void, hide: () => void): void {
    if (current && current.id !== id) {
      current.hide();
    }
    current = { id, hide };
    clearTimeout(cooldown);
    if (show() === false && current.id === id) {
      current = undefined;
    }
  }

  return {
    show(id, delay, immediate, show, hide) {
      const own = timersOf(id);
      clearTimeout(own.close);
      own.close = undefined;
      if (current?.id === id) {
        return;
      }
      if (immediate || delay <= 0 || warmedUp) {
        clearTimeout(own.warm);
        own.warm = undefined;
        reveal(id, show, hide);
        return;
      }
      if (own.warm === undefined) {
        own.warm = setTimeout(() => {
          own.warm = undefined;
          warmedUp = true;
          reveal(id, show, hide);
        }, delay);
      }
    },
    hide(id, closeDelay, immediate, hide) {
      const own = timersOf(id);
      clearTimeout(own.warm);
      own.warm = undefined;
      const conceal = (): void => {
        own.close = undefined;
        if (current?.id === id) {
          current = undefined;
          clearTimeout(cooldown);
          cooldown = setTimeout(() => {
            warmedUp = false;
          }, COOLDOWN);
        }
        hide();
      };
      clearTimeout(own.close);
      if (immediate || closeDelay <= 0) {
        conceal();
      } else {
        own.close = setTimeout(conceal, closeDelay);
      }
    },
    keep(id) {
      const own = timersOf(id);
      clearTimeout(own.close);
      own.close = undefined;
    },
    forget(id) {
      const own = timers.get(id);
      clearTimeout(own?.warm);
      clearTimeout(own?.close);
      timers.delete(id);
      if (current?.id === id) {
        current = undefined;
        clearTimeout(cooldown);
        cooldown = setTimeout(() => {
          warmedUp = false;
        }, COOLDOWN);
      }
    },
  };
}

/** The timing of tooltips. */
export const tooltips: Timing = timing();

/** The triggers that a press holds down. The focus that a press gives them shows no tooltip. */
export const pressedTriggers: WeakSet<Element> = new WeakSet();

/** The timing of previews, apart from tooltips. */
export const previews: Timing = timing();

/** The functions that stop what an open tooltip started, by its element. */
const started = new WeakMap<Element, (() => void)[]>();

export function keepStops(element: Element, stops: (() => void)[]): void {
  started.set(element, stops);
}

/** Runs the functions that stop what an open tooltip started. */
export function runStops(element: Element): void {
  for (const stop of started.get(element) ?? []) {
    stop();
  }
  started.delete(element);
}
