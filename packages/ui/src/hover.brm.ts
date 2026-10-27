// Hover handling for the parts. Only a mouse or a pen hovers: a
// touch screen sends pointer events when a finger taps, which are no hover.
import { $signal } from 'brumate/signals';
import type { HoverEvent } from './events.ts';

/** Hover handling for an element. Returns whether it is hovered, and a function for each event. */
export function hover(
  disabled: boolean | undefined,
  onHoverStart: ((event: HoverEvent) => void) | undefined,
  onHoverEnd: ((event: HoverEvent) => void) | undefined,
  onHoverChange: ((hovered: boolean) => void) | undefined,
) {
  let hovered = $signal(false);

  function enter(event: PointerEvent & { currentTarget: Element }) {
    if (disabled || hovered || event.pointerType === 'touch') {
      return;
    }
    hovered = true;
    const pointerType = event.pointerType === 'pen' ? 'pen' : 'mouse';
    onHoverStart?.({ type: 'hoverstart', pointerType, target: event.currentTarget });
    onHoverChange?.(true);
  }

  function leave(event: PointerEvent & { currentTarget: Element }) {
    if (!hovered) {
      return;
    }
    hovered = false;
    const pointerType = event.pointerType === 'pen' ? 'pen' : 'mouse';
    onHoverEnd?.({ type: 'hoverend', pointerType, target: event.currentTarget });
    onHoverChange?.(false);
  }

  return { hovered, onPointerEnter: enter, onPointerLeave: leave };
}
