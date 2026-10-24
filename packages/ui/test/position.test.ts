// The tests of the placement of overlays follow the tests of calculatePosition in React Aria.
import { expect, it } from 'vitest';
import { computePosition, parsePlacement } from '../src/position.ts';

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
