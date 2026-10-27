// The tests of ColorWheel.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ColorWheels from './fixtures/color-wheels.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function wheels() {
  const page = await mount(ColorWheels, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof wheels>>;

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

/** Gives the track a box of 200 by 200, which happy-dom does not lay out. */
function layout(track: Element) {
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0 }) as DOMRect;
}

const win = window as unknown as Element;

function wait(ms = 50) {
  return new Promise((done) => setTimeout(done, ms));
}

it('has a range input for the hue, named Hue', async () => {
  const page = await wheels();
  const input = range(page, '.wheel');
  expect(input.min).toBe('0');
  expect(input.max).toBe('360');
  expect(input.step).toBe('1');
  expect(input.value).toBe('120');
  expect(input.name).toBe('hue');
  expect(input.getAttribute('aria-label')).toBe('Hue');
  expect(input.getAttribute('aria-valuetext')).toBe('120°, green');
  // A color of another space is read as hue.
  expect(range(page, '.hex').value).toBe('210');
});

it('draws a conic gradient of the hue, masked to the ring', async () => {
  const page = await wheels();
  // The gradient is in the style of the part, which the class of the caller can override. The
  // size and the path of the ring come from the radii.
  const css = [...document.querySelectorAll('style')].map((style) => style.textContent).join('');
  expect(css).toContain('conic-gradient(');
  expect(css).toContain('from 90deg');
  expect(css).toContain('hsl(30, 100%, 50%)');
  const style = page.get('.track').getAttribute('style') ?? '';
  expect(style).toContain('200px');
  expect(style).toContain('path(evenodd, "M 100, 100 m -100, 0');
  expect(style).toContain('m -60, 0');
  expect(page.get('.track').hasAttribute('data-disabled')).toBe(false);
  expect(page.get('.wheel').getAttribute('style')).toContain('200px');
});

it('places the thumb on the ring at the angle of the hue', async () => {
  const page = await wheels();
  const style = page.get('.thumb').getAttribute('style') ?? '';
  // The center of the ring is at a radius of 80 of 100. At 120 degrees that is (-40, 69.28).
  expect(style).toContain(':30%');
  expect(style).toContain(':84.641%');
  expect(style).toContain('hsla(120, 100%, 50%, 1)');
  // At 210 degrees, on the hex wheel.
  expect(page.get('.hex-thumb').getAttribute('style')).toContain(':15.359%');
});

it('sets the hue and keeps the format, the saturation and the lightness', async () => {
  const page = await wheels();
  slide(range(page, '.wheel'), 240);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(240, 50%, 40%)'));
  await page.waitFor(() => expect(state(page)[2]).toBe('hsl(240, 50%, 40%)'));
  slide(range(page, '.hex'), 120);
  await page.waitFor(() => expect(state(page)[1]).toBe('#339933'));
  expect(range(page, '.hex').value).toBe('120');
});

it('wraps the end of the circle to 0', async () => {
  const page = await wheels();
  // The End key of a range input goes to 360, which is 0.
  slide(range(page, '.wheel'), 360);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(0, 50%, 40%)'));
  // Left at 0 goes to 359, as the range input cannot.
  const input = range(page, '.wheel');
  input.focus();
  press('ArrowLeft', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(359, 50%, 40%)'));
  press('ArrowDown', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(358, 50%, 40%)'));
  press('ArrowUp', input);
  press('ArrowRight', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(0, 50%, 40%)'));
});

it('moves a page of 15 with Shift and an arrow', async () => {
  const page = await wheels();
  const input = range(page, '.wheel');
  input.focus();
  press('Home', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(0, 50%, 40%)'));
  press('ArrowRight', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(15, 50%, 40%)'));
  press('ArrowUp', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(30, 50%, 40%)'));
  press('ArrowLeft', input, { shiftKey: true });
  press('ArrowDown', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(0, 50%, 40%)'));
});

it('moves a page of 15 with PageUp and PageDown, to a multiple of the page', async () => {
  const page = await wheels();
  const input = range(page, '.wheel');
  input.focus();
  press('PageUp', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(135, 50%, 40%)'));
  press('PageDown', input);
  press('PageDown', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(105, 50%, 40%)'));
  await page.waitFor(() => expect(state(page)[2]).toBe('hsl(105, 50%, 40%)'));
  slide(input, 0);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(0, 50%, 40%)'));
  press('PageDown', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(345, 50%, 40%)'));
  press('PageUp', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(0, 50%, 40%)'));
});

it('moves to a press on the ring and follows the drag', async () => {
  const page = await wheels();
  const track = page.get('.track');
  layout(track);
  // 90 from the center to the right is 0 degrees, and below is 90.
  pointer('pointerdown', track, { clientX: 190, clientY: 100 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(0, 50%, 40%)'));
  expect(page.get('.thumb').hasAttribute('data-dragging')).toBe(true);
  expect(document.activeElement).toBe(range(page, '.wheel'));
  pointer('pointermove', win, { clientX: 100, clientY: 190, buttons: 1 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(90, 50%, 40%)'));
  pointer('pointermove', win, { clientX: 10, clientY: 100, buttons: 1 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(180, 50%, 40%)'));
  pointer('pointerup', win, { clientX: 10, clientY: 100 });
  await page.waitFor(() => expect(page.get('.thumb').hasAttribute('data-dragging')).toBe(false));
  await page.waitFor(() => expect(state(page)[2]).toBe('hsl(180, 50%, 40%)'));
});

it('does nothing for a press off the ring', async () => {
  const page = await wheels();
  const track = page.get('.track');
  layout(track);
  // The middle is inside the inner radius, and the corner is outside the outer radius.
  pointer('pointerdown', track, { clientX: 100, clientY: 100 });
  pointer('pointerdown', track, { clientX: 5, clientY: 5 });
  await wait();
  expect(state(page)[0]).toBe('hsl(120, 50%, 40%)');
  expect(page.get('.thumb').hasAttribute('data-dragging')).toBe(false);
});

it('drags the thumb from where it was taken', async () => {
  const page = await wheels();
  layout(page.get('.track'));
  // The thumb is at (-40, 69.28) from the center. The pointer takes it anywhere on the thumb.
  pointer('pointerdown', page.get('.thumb'), { clientX: 60, clientY: 170 });
  await page.waitFor(() => expect(page.get('.thumb').hasAttribute('data-dragging')).toBe(true));
  expect(document.activeElement).toBe(range(page, '.wheel'));
  // The pointer moves up by 138.56, so the thumb is at (-40, -69.28): 240 degrees.
  pointer('pointermove', win, { clientX: 60, clientY: 31.44, buttons: 1 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(240, 50%, 40%)'));
  pointer('pointerup', win, { clientX: 60, clientY: 31.44 });
  await page.waitFor(() => expect(state(page)[2]).toBe('hsl(240, 50%, 40%)'));
});

it('keeps a disabled wheel still', async () => {
  const page = await wheels();
  const input = range(page, '.off');
  expect(input.disabled).toBe(true);
  for (const selector of ['.off', '.off-track', '.off-thumb']) {
    expect(page.get(selector).hasAttribute('data-disabled')).toBe(true);
  }
  layout(page.get('.off-track'));
  pointer('pointerdown', page.get('.off-track'), { clientX: 190, clientY: 100 });
  await wait();
  expect(state(page)[1]).toBe('#336699');
});

it('shows focus on the thumb', async () => {
  const page = await wheels();
  const thumb = page.get('.thumb');
  expect(thumb.hasAttribute('data-focused')).toBe(false);
  range(page, '.wheel').focus();
  await page.waitFor(() => expect(thumb.hasAttribute('data-focused')).toBe(true));
  range(page, '.wheel').blur();
  await page.waitFor(() => expect(thumb.hasAttribute('data-focused')).toBe(false));
});

it('gives back the first color on a reset of the form', async () => {
  const page = await wheels();
  expect(range(page, '.reset').name).toBe('reset');
  slide(range(page, '.reset'), 300);
  await page.waitFor(() => expect(state(page)[3]).toBe('hsb(300, 50%, 80%)'));
  (page.get('.form') as HTMLFormElement).reset();
  await page.waitFor(() => expect(state(page)[3]).toBe('hsb(200, 50%, 80%)'));
  expect(range(page, '.reset').value).toBe('200');
});
