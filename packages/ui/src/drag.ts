// A drag that follows the pointer with listeners of the window, for parts whose code loads on
// the first press, after the pointer went down.

/**
 * The drags by their pointer, such as of Slider thumbs, which the window follows until each
 * pointer goes up. Two pointers, such as two fingers, drag two thumbs.
 */
const drags = new Map<number, { move: (event: PointerEvent) => void; end: () => void }>();

function moved(event: PointerEvent): void {
  const drag = drags.get(event.pointerId);
  if (!drag) {
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
  stopDrag(event.pointerId);
}

/** Ends the drag of a pointer, and runs its end. */
function stopDrag(pointer: number): void {
  const drag = drags.get(pointer);
  if (!drag) {
    return;
  }
  drags.delete(pointer);
  if (drags.size === 0) {
    window.removeEventListener('pointermove', moved);
    window.removeEventListener('pointerup', ended);
    window.removeEventListener('pointercancel', ended);
  }
  drag.end();
}

/** Follows the pointer until it goes up, with listeners of the window that stay the same. */
export function startDrag(
  pointer: number,
  move: (event: PointerEvent) => void,
  end: () => void,
): void {
  // A pointer drags one thing at a time, so a drag that it had ends first.
  stopDrag(pointer);
  drags.set(pointer, { move, end });
  window.addEventListener('pointermove', moved);
  window.addEventListener('pointerup', ended);
  window.addEventListener('pointercancel', ended);
}
