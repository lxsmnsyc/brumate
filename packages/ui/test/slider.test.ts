// The tests of Slider follow the tests of Slider in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Sliders from './fixtures/sliders.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function sliders() {
  const page = await mount(Sliders, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof sliders>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function range(page: Page, selector: string) {
  return page.get(`${selector} input[type=range]`) as HTMLInputElement;
}

function slide(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Gives the track a box, which happy-dom does not lay out. */
function layout(track: Element, width: number) {
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height: 10, right: width, bottom: 10, x: 0, y: 0 }) as DOMRect;
}

it('is a group that its label names, with a range input for each thumb', async () => {
  const page = await sliders();
  const group = page.get('.volume');
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(page.get('.volume-label').id);
  const input = range(page, '.volume-thumb');
  expect(input.getAttribute('aria-labelledby')).toBe(page.get('.volume-label').id);
  expect(input.min).toBe('0');
  expect(input.max).toBe('100');
  expect(input.step).toBe('10');
  expect(input.value).toBe('40');
  expect(input.name).toBe('volume');
  expect(page.get('.volume-output').getAttribute('for')).toBe(input.id);
  expect(page.text('.volume-output')).toBe('40');
  expect((page.get('.volume-thumb') as HTMLElement).style.left).toBe('40%');
});

it('names each thumb of a range, keeps them in order, and formats the values', async () => {
  const page = await sliders();
  const low = range(page, '.low');
  const high = range(page, '.high');
  const label = page.get('.price-label').id;
  expect(low.getAttribute('aria-labelledby')).toBe(`${low.id} ${label}`);
  expect(low.getAttribute('aria-valuetext')).toBe('$20');
  expect(low.max).toBe('80');
  expect(high.min).toBe('20');
  expect(page.text('.price-output')).toMatch(/^\$20\s*[–-]\s*\$80$/);
  // A thumb stops at the thumb next to it.
  slide(low, 95);
  await page.waitFor(() => expect(state(page)[1]).toEqual([80, 80]));
  slide(high, 90);
  await page.waitFor(() => expect(range(page, '.low').max).toBe('90'));
});

it('steps with the keys of the range input, and a page with PageUp and PageDown', async () => {
  const page = await sliders();
  const input = range(page, '.volume-thumb');
  slide(input, 50);
  await page.waitFor(() => expect(state(page)[0]).toBe(50));
  expect(state(page)[2]).toBe(50);
  input.focus();
  press('PageUp', input);
  await page.waitFor(() => expect(state(page)[0]).toBe(60));
  press('PageDown', input);
  press('PageDown', input);
  await page.waitFor(() => expect(state(page)[0]).toBe(40));
  // A value off the steps moves to the nearest step.
  slide(input, 44);
  await page.waitFor(() => expect(page.text('.volume-output')).toBe('40'));
});

it('moves the nearest thumb to a press on the track, and drags it', async () => {
  const page = await sliders();
  const track = page.get('.price-track');
  layout(track, 200);
  // 160 of 200 is 80, nearer the high thumb.
  pointer('pointerdown', track, { clientX: 150, clientY: 5 });
  await page.waitFor(() => expect(state(page)[1]).toEqual([20, 75]));
  expect(document.activeElement).toBe(range(page, '.high'));
  pointer('pointermove', window as unknown as Element, { clientX: 190, clientY: 5, buttons: 1 });
  await page.waitFor(() => expect(state(page)[1]).toEqual([20, 95]));
  pointer('pointerup', window as unknown as Element, { clientX: 190, clientY: 5 });
  pointer('pointermove', window as unknown as Element, { clientX: 10, clientY: 5, buttons: 1 });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[1]).toEqual([20, 95]);
  // A drag of a thumb stops at the thumb next to it.
  pointer('pointerdown', page.get('.low'), { clientX: 40, clientY: 5 });
  // The code of the thumb loads on its first press, and then the drag begins.
  await page.waitFor(() => expect(page.get('.low').hasAttribute('data-dragging')).toBe(true));
  pointer('pointermove', window as unknown as Element, { clientX: 199, clientY: 5, buttons: 1 });
  await page.waitFor(() => expect(state(page)[1]).toEqual([95, 95]));
  pointer('pointerup', window as unknown as Element, {});
  await page.waitFor(() => expect(state(page)[2]).toBe(null));
});
