// The move of a SelectionIndicator from the item that was selected to the one that is, as the
// SharedElementTransition of React Aria animates it.
import { createContext } from 'brumate/context';
import type { Context } from 'brumate/context';

/** What a selectable item gives a SelectionIndicator inside it. */
export interface SelectionIndicatorState {
  isSelected: boolean;
}

export const SelectionIndicatorContext: Context<SelectionIndicatorState | null> =
  createContext<SelectionIndicatorState | null>('brumate-ui:selection-indicator', null);

/** The element that the indicators of one selection move in: the collection or the group. */
const CONTAINER = '[data-collection], [role=radiogroup], [role=toolbar]';

/** Where the indicator of each container was last, relative to the container. */
const places = new WeakMap<Element, { x: number; y: number; width: number; height: number }>();

function placeOf(element: Element, container: Element) {
  const box = element.getBoundingClientRect();
  const frame = container.getBoundingClientRect();
  return { x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height };
}

/** The first duration of a list such as `0.2s, 1s`, in milliseconds. */
function milliseconds(value: string): number {
  const first = value.split(',')[0]!.trim();
  const amount = Number.parseFloat(first);
  if (Number.isNaN(amount)) {
    return 0;
  }
  return first.endsWith('ms') ? amount : amount * 1000;
}

/**
 * Moves an indicator that just appeared from where the last one of its container was. Its CSS
 * `transition-duration` and `transition-timing-function` set the move, and with no duration it
 * does not move, so the styles decide. It does not move when the user asks for less motion.
 */
export function moveIndicator(element: HTMLElement): void {
  const container = element.closest(CONTAINER);
  if (!container) {
    return;
  }
  const next = placeOf(element, container);
  const last = places.get(container);
  places.set(container, next);
  const style = getComputedStyle(element);
  const duration = milliseconds(style.transitionDuration);
  if (
    !last ||
    duration === 0 ||
    typeof element.animate !== 'function' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }
  const scaleX = next.width > 0 ? last.width / next.width : 1;
  const scaleY = next.height > 0 ? last.height / next.height : 1;
  element.animate(
    [
      {
        transformOrigin: 'top left',
        transform: `translate(${last.x - next.x}px, ${last.y - next.y}px) scale(${scaleX}, ${scaleY})`,
      },
      { transformOrigin: 'top left', transform: 'none' },
    ],
    { duration, easing: style.transitionTimingFunction.split(',')[0] || 'ease' },
  );
}
