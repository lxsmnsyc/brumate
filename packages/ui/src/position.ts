// Places an overlay next to its trigger: on a side of
// the trigger, flipped to the other side when it does not fit, and kept inside the viewport.
// The overlay is `position: fixed` and placed with `top` and `left`, never with a transform, so
// the layer of an overlay is never the containing block of the overlays inside it.

/** A side of the trigger, and where the overlay lines up along it. */
export type Placement =
  | 'top'
  | 'top start'
  | 'top end'
  | 'bottom'
  | 'bottom start'
  | 'bottom end'
  | 'start'
  | 'start top'
  | 'start bottom'
  | 'end'
  | 'end top'
  | 'end bottom'
  | 'left'
  | 'left top'
  | 'left bottom'
  | 'right'
  | 'right top'
  | 'right bottom';

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'center' | 'start' | 'end';

export interface PositionOptions {
  placement: Placement;
  /** The space between the trigger and the overlay, in pixels. */
  offset: number;
  /** A shift along the side of the trigger, in pixels. */
  crossOffset: number;
  /** Flip to the other side when the overlay does not fit. */
  shouldFlip: boolean;
  /** The space that the overlay keeps from the edges of the viewport, in pixels. */
  containerPadding: number;
  direction: 'ltr' | 'rtl';
}

export interface Position {
  top: number;
  left: number;
  /** The side of the trigger that the overlay is on, after a flip. */
  side: Side;
  /** Where the arrow points at the trigger, along the side of the overlay, in pixels. */
  arrow: number;
  /** The space that the overlay has before it reaches the edge of the viewport, in pixels. */
  maxHeight: number;
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** The side and the alignment of a placement, with start and end read in the direction. */
export function parsePlacement(placement: Placement, direction: 'ltr' | 'rtl'): [Side, Align] {
  const [first, second] = placement.split(' ') as [string, string | undefined];
  const logical = (value: string): string => {
    if (value === 'start') {
      return direction === 'rtl' ? 'right' : 'left';
    }
    if (value === 'end') {
      return direction === 'rtl' ? 'left' : 'right';
    }
    return value;
  };
  const side = logical(first) as Side;
  let align: Align = 'center';
  if (second) {
    // `top start` lines up the start edges. Along a vertical side, start is the top.
    const vertical = side === 'top' || side === 'bottom';
    const value = vertical ? logical(second) : second;
    align = value === 'left' || value === 'top' ? 'start' : 'end';
  }
  return [side, align];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Where the overlay goes for the rectangles of its trigger and of itself. */
export function computePosition(
  trigger: DOMRect,
  overlay: { width: number; height: number },
  viewport: { width: number; height: number },
  options: PositionOptions,
): Position {
  const [wanted, align] = parsePlacement(options.placement, options.direction);
  const pad = options.containerPadding;
  const room: Record<Side, number> = {
    top: trigger.top - pad - options.offset,
    bottom: viewport.height - trigger.bottom - pad - options.offset,
    left: trigger.left - pad - options.offset,
    right: viewport.width - trigger.right - pad - options.offset,
  };
  const size = (side: Side): number =>
    side === 'top' || side === 'bottom' ? overlay.height : overlay.width;
  let side = wanted;
  // Flip when the other side has room and this one does not.
  if (options.shouldFlip && room[side] < size(side) && room[OPPOSITE[side]] > room[side]) {
    side = OPPOSITE[side];
  }
  const vertical = side === 'top' || side === 'bottom';
  let top: number;
  let left: number;
  if (vertical) {
    top =
      side === 'top'
        ? trigger.top - options.offset - overlay.height
        : trigger.bottom + options.offset;
    if (align === 'start') {
      left = trigger.left;
    } else if (align === 'end') {
      left = trigger.right - overlay.width;
    } else {
      left = trigger.left + trigger.width / 2 - overlay.width / 2;
    }
    left = clamp(left + options.crossOffset, pad, viewport.width - pad - overlay.width);
  } else {
    left =
      side === 'left'
        ? trigger.left - options.offset - overlay.width
        : trigger.right + options.offset;
    if (align === 'start') {
      top = trigger.top;
    } else if (align === 'end') {
      top = trigger.bottom - overlay.height;
    } else {
      top = trigger.top + trigger.height / 2 - overlay.height / 2;
    }
    top = clamp(top + options.crossOffset, pad, viewport.height - pad - overlay.height);
  }
  // The arrow points at the middle of the trigger, from the edge of the overlay. It stays on the
  // overlay, when the overlay is pushed away from the edge of the viewport.
  const arrow = vertical
    ? clamp(trigger.left + trigger.width / 2 - left, 0, overlay.width)
    : clamp(trigger.top + trigger.height / 2 - top, 0, overlay.height);
  const maxHeight = vertical ? Math.max(0, room[side]) : viewport.height - pad * 2;
  return { top, left, side, arrow, maxHeight };
}

/**
 * Keeps the overlay next to its trigger: now, as the page scrolls or resizes, and as either of
 * them changes size. Returns the function that stops it.
 */
export function followTrigger(
  trigger: Element,
  overlay: HTMLElement,
  options: PositionOptions,
  placed: (position: Position) => void,
): () => void {
  let frame = 0;
  const { put, stop } = keepStyle(overlay);
  const update = (): void => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const position = computePosition(
        trigger.getBoundingClientRect(),
        { width: overlay.offsetWidth, height: overlay.offsetHeight },
        {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
        options,
      );
      put('top', `${position.top}px`);
      put('left', `${position.left}px`);
      put('--trigger-width', `${trigger.getBoundingClientRect().width}px`);
      put('--available-height', `${position.maxHeight}px`);
      placed(position);
    });
  };
  update();
  // Scrolls of any container move the trigger, so the listener is on the document, at capture.
  document.addEventListener('scroll', update, { capture: true, passive: true });
  window.addEventListener('resize', update);
  const sizes = new ResizeObserver(update);
  sizes.observe(trigger);
  sizes.observe(overlay);
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('scroll', update, { capture: true });
    window.removeEventListener('resize', update);
    sizes.disconnect();
    stop();
  };
}

/**
 * Sets properties on the style of an element, and sets them again when a new `style` attribute
 * replaces them, such as a `style` prop that changes. `stop` ends it.
 */
export function keepStyle(element: HTMLElement): {
  put: (name: string, value: string) => void;
  stop: () => void;
} {
  const kept = new Map<string, string>();
  const observer = new MutationObserver(() => {
    for (const [name, value] of kept) {
      if (element.style.getPropertyValue(name) !== value) {
        element.style.setProperty(name, value);
      }
    }
  });
  observer.observe(element, { attributes: true, attributeFilter: ['style'] });
  return {
    put(name, value) {
      kept.set(name, value);
      element.style.setProperty(name, value);
    },
    stop() {
      observer.disconnect();
    },
  };
}
