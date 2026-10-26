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

interface Place {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The last indicator of each container: where it was relative to the container, and where the
 * element around it was then. That element stays when the indicator leaves.
 */
const places = new WeakMap<
  Element,
  { element: Element; place: Place; anchor: Element | null; anchorPlace: Place }
>();

function placeOf(element: Element, container: Element): Place {
  const box = element.getBoundingClientRect();
  const frame = container.getBoundingClientRect();
  return { x: box.left - frame.left, y: box.top - frame.top, width: box.width, height: box.height };
}

/**
 * Where the last indicator would be now. The layout can change after it moved, such as on a
 * resize, so it moves by as much as the element around it moved since. The indicator has left
 * the page by now, and its size stays as the last one that it had.
 */
function lastPlace(container: Element): Place | undefined {
  const last = places.get(container);
  if (!last) {
    return undefined;
  }
  const { place, anchor, anchorPlace } = last;
  if (!anchor?.isConnected || !container.contains(anchor)) {
    return place;
  }
  const now = placeOf(anchor, container);
  return { ...place, x: place.x + now.x - anchorPlace.x, y: place.y + now.y - anchorPlace.y };
}

/** The element around an indicator that has a box, past those with `display: contents`. */
function anchorOf(element: HTMLElement, container: Element): Element | null {
  for (let node = element.parentElement; node && node !== container; node = node.parentElement) {
    const box = node.getBoundingClientRect();
    if (box.width > 0 || box.height > 0) {
      return node;
    }
  }
  return null;
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

/** Keeps where an indicator is, and returns it. */
function record(element: HTMLElement, container: Element): Place {
  const place = placeOf(element, container);
  const anchor = anchorOf(element, container);
  places.set(container, {
    element,
    place,
    anchor,
    anchorPlace: anchor ? placeOf(anchor, container) : place,
  });
  return place;
}

/**
 * Keeps the place of an indicator while its size changes, such as when a font loads or the page
 * resizes, until it leaves the page.
 */
const sizes =
  typeof ResizeObserver === 'undefined'
    ? undefined
    : new ResizeObserver((records) => {
        for (const { target } of records) {
          const container = target.closest(CONTAINER);
          if (!target.isConnected || !container) {
            sizes!.unobserve(target);
          } else if (places.get(container)?.element === target) {
            record(target as HTMLElement, container);
          }
        }
      });

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
  const last = lastPlace(container);
  const next = record(element, container);
  sizes?.observe(element);
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
