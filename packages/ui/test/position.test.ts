// The tests of the placement of overlays.
import { afterEach, expect, it } from 'vitest';
import {
  computePosition,
  followTrigger,
  parseLength,
  parsePlacement,
  readLength,
} from '../src/position.ts';

const trigger = { top: 100, bottom: 130, left: 200, right: 280, width: 80, height: 30 } as DOMRect;
const overlay = { width: 120, height: 60 };
const viewport = { width: 1000, height: 800 };
const options = {
  placement: 'bottom' as const,
  offset: 8,
  crossOffset: 0,
  shouldFlip: true,
  containerPadding: 12,
  direction: 'ltr' as const,
};

// followTrigger in the DOM: the max-height that it sets.
const stops: (() => void)[] = [];
async function follow(setup: (overlay: HTMLElement) => void): Promise<HTMLElement> {
  const anchor = document.createElement('button');
  const overlay = document.createElement('div');
  setup(overlay);
  document.body.append(anchor, overlay);
  const stop = followTrigger(anchor, overlay, { ...options, fitHeight: true }, () => {});
  stops.push(
    stop,
    () => anchor.remove(),
    () => overlay.remove(),
  );
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  return overlay;
}
afterEach(() => {
  for (const stop of stops.splice(0)) {
    stop();
  }
  for (const sheet of document.querySelectorAll('style')) {
    sheet.remove();
  }
});

it('places the overlay below the trigger, centered, with the offset', () => {
  const position = computePosition(trigger, overlay, viewport, options);
  expect(position.side).toBe('bottom');
  expect(position.top).toBe(138);
  expect(position.left).toBe(180);
  // The arrow points at the middle of the trigger.
  expect(position.arrow).toBe(60);
});

it('lines up the start or the end edges, and reads start and end in the direction', () => {
  expect(
    computePosition(trigger, overlay, viewport, { ...options, placement: 'bottom start' }).left,
  ).toBe(200);
  expect(
    computePosition(trigger, overlay, viewport, { ...options, placement: 'bottom end' }).left,
  ).toBe(160);
  expect(parsePlacement('start', 'rtl')).toEqual(['right', 'center']);
  expect(parsePlacement('bottom start', 'rtl')).toEqual(['bottom', 'end']);
  expect(parsePlacement('end top', 'ltr')).toEqual(['right', 'start']);
});

it('flips to the other side when the overlay does not fit', () => {
  const low = { ...trigger, top: 740, bottom: 770 } as DOMRect;
  const position = computePosition(low, overlay, viewport, options);
  expect(position.side).toBe('top');
  expect(position.top).toBe(740 - 8 - 60);
  expect(computePosition(low, overlay, viewport, { ...options, shouldFlip: false }).side).toBe(
    'bottom',
  );
});

it('keeps the overlay inside the viewport, with the padding', () => {
  const edge = { ...trigger, left: 0, right: 40, width: 40 } as DOMRect;
  expect(computePosition(edge, overlay, viewport, options).left).toBe(12);
});

it('places the overlay beside the trigger for a side placement', () => {
  const position = computePosition(trigger, overlay, viewport, { ...options, placement: 'right' });
  expect(position.side).toBe('right');
  expect(position.left).toBe(288);
  expect(position.top).toBe(85);
});

it('keeps the arrow on the overlay when the overlay is pushed from the edge', () => {
  // A trigger at the left edge: the overlay is pushed right, past the middle of the trigger.
  const edge = { top: 100, bottom: 130, left: -40, right: 0, width: 40, height: 30 } as DOMRect;
  const position = computePosition(edge, overlay, viewport, options);
  expect(position.left).toBe(12);
  expect(position.arrow).toBe(0);
});

it('reads a length in pixels from a custom property value', () => {
  expect(parseLength('8')).toBe(8);
  expect(parseLength(' 4px ')).toBe(4);
  expect(parseLength('-2.5px')).toBe(-2.5);
  expect(parseLength('')).toBeUndefined();
  expect(parseLength('1rem')).toBeUndefined();
});

it('sets max-height to the room that is left', async () => {
  const overlay = await follow(() => {});
  expect(overlay.style.getPropertyValue('--available-height')).not.toBe('');
  expect(overlay.style.maxHeight).toBe(overlay.style.getPropertyValue('--available-height'));
  expect(overlay.style.overflowY).toBe('auto');
});

it('keeps a max-height that the author sets inline', async () => {
  const overlay = await follow((element) => {
    element.style.maxHeight = '50px';
  });
  expect(overlay.style.maxHeight).toBe('50px');
});

it('leaves a max-height of the author stylesheet to win', async () => {
  const sheet = document.createElement('style');
  sheet.textContent = '.limited { max-height: 40px }';
  document.head.append(sheet);
  const overlay = await follow((element) => {
    element.className = 'limited';
  });
  expect(overlay.style.maxHeight).toBe('');
});

it('reads the anchor lengths from custom properties', () => {
  const element = document.createElement('div');
  element.style.setProperty('--anchor-gap', '4px');
  document.body.append(element);
  expect(readLength(element, '--anchor-gap')).toBe(4);
  expect(readLength(element, '--anchor-offset')).toBeUndefined();
  element.remove();
});

it('keeps an overflow that the author sets', async () => {
  const overlay = await follow((element) => {
    element.style.overflow = 'hidden';
  });
  expect(overlay.style.maxHeight).not.toBe('');
  expect(overlay.style.overflowY).toBe('');
});

it('puts max-height and overflow back when a new style replaces them', async () => {
  const overlay = await follow(() => {});
  const height = overlay.style.maxHeight;
  expect(height).not.toBe('');
  overlay.style.cssText = 'color: red';
  // The observer runs after the change, as a microtask.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(overlay.style.maxHeight).toBe(height);
  expect(overlay.style.overflowY).toBe('auto');
});
