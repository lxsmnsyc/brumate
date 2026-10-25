// A drag that follows the pointer with listeners of the window, for parts whose code loads on
// the first press, after the pointer went down.

/** The drag that the window follows until the pointer goes up, such as of a Slider thumb. */
let drag: { pointer: number; move: (event: PointerEvent) => void; end: () => void } | undefined;

function moved(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointer) {
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
  if (drag && event.pointerId === drag.pointer) {
    const done = drag;
    stopDrag();
    done.end();
  }
}

function stopDrag(): void {
  drag = undefined;
  window.removeEventListener('pointermove', moved);
  window.removeEventListener('pointerup', ended);
  window.removeEventListener('pointercancel', ended);
}

/** Follows the pointer until it goes up, with listeners of the window that stay the same. */
export function startDrag(
  pointer: number,
  move: (event: PointerEvent) => void,
  end: () => void,
): void {
  stopDrag();
  drag = { pointer, move, end };
  window.addEventListener('pointermove', moved);
  window.addEventListener('pointerup', ended);
  window.addEventListener('pointercancel', ended);
}
