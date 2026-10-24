// The timing of tooltips, after useTooltipTriggerState of React Aria. A tooltip shows after a
// delay on hover. Once one has shown, the others show at once, until none has shown for a
// moment. One tooltip shows at a time.
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

/** How long the others show at once after a tooltip hides, in milliseconds. */
const COOLDOWN = 500;

let warmedUp = false;
let cooldown: ReturnType<typeof setTimeout> | undefined;
/** The tooltip that shows, and the function that hides it. */
let current: { id: string; hide: () => void } | undefined;
/** The timers of each tooltip, by its ID. */
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

function reveal(id: string, show: () => void, hide: () => void): void {
  if (current && current.id !== id) {
    current.hide();
  }
  current = { id, hide };
  clearTimeout(cooldown);
  show();
}

/**
 * Shows a tooltip: at once when `immediate`, such as on focus, or when another tooltip showed a
 * moment ago, or else after `delay`.
 */
export function showTooltip(
  id: string,
  delay: number,
  immediate: boolean,
  show: () => void,
  hide: () => void,
): void {
  const own = timersOf(id);
  clearTimeout(own.close);
  if (current?.id === id) {
    return;
  }
  if (immediate || delay <= 0 || warmedUp) {
    clearTimeout(own.warm);
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
}

/** Hides a tooltip: at once when `immediate`, or else after `closeDelay`. */
export function hideTooltip(
  id: string,
  closeDelay: number,
  immediate: boolean,
  hide: () => void,
): void {
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
}

/** Cancels the hide of a tooltip that waits for its close delay. */
export function keepTooltip(id: string): void {
  const own = timersOf(id);
  clearTimeout(own.close);
  own.close = undefined;
}

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
