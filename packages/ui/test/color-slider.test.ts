// The tests of ColorSlider and ColorThumb follow the tests of ColorSlider in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ColorSliders from './fixtures/color-sliders.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function sliders() {
  const page = await mount(ColorSliders, {});
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
function layout(track: Element, width: number, height = 20) {
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

const win = window as unknown as Element;

it('is a group named by its label, with a range input for the channel', async () => {
  const page = await sliders();
  const group = page.get('.hue');
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-labelledby')).toBe(page.get('.hue-label').id);
  const input = range(page, '.hue-thumb');
  expect(input.min).toBe('0');
  expect(input.max).toBe('360');
  expect(input.step).toBe('1');
  expect(input.value).toBe('180');
  expect(input.name).toBe('hue');
  expect(input.getAttribute('aria-labelledby')).toBe(page.get('.hue-label').id);
  expect(input.getAttribute('aria-valuetext')).toBe('180°, cyan');
  expect(page.get('.hue-output').getAttribute('for')).toBe(input.id);
  expect(page.text('.hue-output')).toBe('180°');
});

it('draws the track and the thumb from the color, for the styles of the caller', async () => {
  const page = await sliders();
  // The track is the gradient of the channel, as a custom property on the slider.
  expect(page.get('.hue').getAttribute('style')).toContain(
    'linear-gradient(to right, hsla(0, 100%, 50%, 1)',
  );
  const thumb = page.get('.hue-thumb');
  expect(thumb.hasAttribute('data-color-thumb')).toBe(true);
  expect(thumb.getAttribute('style')).toContain('hsla(180, 100%, 50%, 1)');
  expect(page.get('.red').getAttribute('style')).toContain(
    'rgba(0, 102, 153, 1), rgba(255, 102, 153, 1)',
  );
  expect(page.get('.alpha').getAttribute('style')).toContain(
    'linear-gradient(to top, rgba(10, 20, 30, 0)',
  );
});

it('is named by its channel when it has no label', async () => {
  const page = await sliders();
  const input = range(page, '.red-thumb');
  expect(input.getAttribute('aria-label')).toBe('Red');
  expect(page.get('.red').getAttribute('aria-label')).toBe('Red');
  expect(input.value).toBe('51');
  expect(input.getAttribute('aria-valuetext')).toBe('51, blue');
});

it('writes the channel in the format of the value, and ends with the change', async () => {
  const page = await sliders();
  slide(range(page, '.hue-thumb'), 240);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(240, 100%, 50%)'));
  expect(page.text('.hue-output')).toBe('240°');
  await page.waitFor(() => expect(state(page)[3]).toBe('hsl(240, 100%, 50%)'));
  slide(range(page, '.red-thumb'), 255);
  await page.waitFor(() => expect(state(page)[1]).toBe('#FF6699'));
  slide(range(page, '.alpha-thumb'), 0.25);
  await page.waitFor(() => expect(state(page)[2]).toBe('rgba(10, 20, 30, 0.25)'));
  expect(page.text('.alpha-output')).toBe('25%');
});

it('moves a page with PageUp and PageDown, as the range of the channel says', async () => {
  const page = await sliders();
  const input = range(page, '.red-thumb');
  input.focus();
  press('PageUp', input);
  await page.waitFor(() => expect(state(page)[1]).toBe('#446699'));
  press('PageDown', input);
  press('PageDown', input);
  await page.waitFor(() => expect(state(page)[1]).toBe('#226699'));
  const alpha = range(page, '.alpha-thumb');
  expect(alpha.max).toBe('1');
  expect(alpha.step).toBe('0.01');
  alpha.focus();
  press('PageUp', alpha);
  await page.waitFor(() => expect(state(page)[2]).toBe('rgba(10, 20, 30, 0.6)'));
});

it('reads a channel of another space, and keeps a disabled slider still', async () => {
  const page = await sliders();
  const input = range(page, '.light-thumb');
  // #336699 has a lightness of 40%.
  expect(input.value).toBe('40');
  expect(input.disabled).toBe(true);
  expect(page.text('.light-output')).toBe('40%');
  expect(page.get('.light').hasAttribute('data-disabled')).toBe(true);
  expect(page.get('.light-thumb').hasAttribute('data-disabled')).toBe(true);
  layout(page.get('.light-track'), 100);
  pointer('pointerdown', page.get('.light-track'), { clientX: 90, clientY: 5 });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[1]).toBe('#336699');
});

it('lays a vertical slider upward', async () => {
  const page = await sliders();
  expect(page.get('.alpha').getAttribute('data-orientation')).toBe('vertical');
  expect(range(page, '.alpha-thumb').getAttribute('aria-orientation')).toBe('vertical');
  const track = page.get('.alpha-track');
  layout(track, 10, 100);
  // A press 20 from the bottom is 20%.
  pointer('pointerdown', track, { clientX: 5, clientY: 80 });
  await page.waitFor(() => expect(state(page)[2]).toBe('rgba(10, 20, 30, 0.2)'));
  pointer('pointerup', win, {});
});

it('moves to a press on the track and drags the thumb from where it was taken', async () => {
  const page = await sliders();
  const track = page.get('.hue-track');
  layout(track, 200);
  // 100 of 200 is 180 of 360. The pointer takes the thumb 10 to the right of its center.
  pointer('pointerdown', page.get('.hue-thumb'), { clientX: 110, clientY: 10 });
  await page.waitFor(() => expect(page.get('.hue-thumb').hasAttribute('data-dragging')).toBe(true));
  expect(document.activeElement).toBe(range(page, '.hue-thumb'));
  pointer('pointermove', win, { clientX: 150, clientY: 10, buttons: 1 });
  // 40 to the right is 72 degrees more, not a jump to the pointer.
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(252, 100%, 50%)'));
  pointer('pointerup', win, { clientX: 150, clientY: 10 });
  await page.waitFor(() =>
    expect(page.get('.hue-thumb').hasAttribute('data-dragging')).toBe(false),
  );
  await page.waitFor(() => expect(state(page)[3]).toBe('hsl(252, 100%, 50%)'));
  pointer('pointerdown', track, { clientX: 20, clientY: 10 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(36, 100%, 50%)'));
  pointer('pointerup', win, {});
});

it('shows focus on the thumb', async () => {
  const page = await sliders();
  const thumb = page.get('.hue-thumb');
  expect(thumb.hasAttribute('data-focused')).toBe(false);
  range(page, '.hue-thumb').focus();
  await page.waitFor(() => expect(thumb.hasAttribute('data-focused')).toBe(true));
  range(page, '.hue-thumb').blur();
  await page.waitFor(() => expect(thumb.hasAttribute('data-focused')).toBe(false));
});

it('gives back the first color on a reset of the form', async () => {
  const page = await sliders();
  expect(range(page, '.green-thumb').name).toBe('green');
  slide(range(page, '.green-thumb'), 100);
  await page.waitFor(() => expect(state(page)[4]).toBe('#006400'));
  (page.get('.form') as HTMLFormElement).reset();
  await page.waitFor(() => expect(state(page)[4]).toBe('#00ff00'));
  expect(range(page, '.green-thumb').value).toBe('255');
});

it('moves a step with the arrows, a page with Shift, and to the ends with Home and End', async () => {
  const page = await sliders();
  const input = range(page, '.red-thumb');
  input.focus();
  // Red is 51, with a step of 1 and a page of 17.
  press('ArrowRight', input);
  await page.waitFor(() => expect(state(page)[1]).toBe('#346699'));
  press('ArrowUp', input);
  await page.waitFor(() => expect(state(page)[1]).toBe('#356699'));
  press('ArrowLeft', input);
  press('ArrowDown', input);
  press('ArrowDown', input);
  await page.waitFor(() => expect(state(page)[1]).toBe('#336699'));
  // Shift moves a page, as in React Aria.
  press('ArrowRight', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[1]).toBe('#446699'));
  press('ArrowLeft', input, { shiftKey: true });
  press('ArrowDown', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[1]).toBe('#226699'));
  press('End', input);
  await page.waitFor(() => expect(state(page)[1]).toBe('#FF6699'));
  press('Home', input);
  await page.waitFor(() => expect(state(page)[1]).toBe('#006699'));
});

it('ends the change after a key', async () => {
  const page = await sliders();
  const input = range(page, '.hue-thumb');
  input.focus();
  press('ArrowRight', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[3]).toBe('hsl(195, 100%, 50%)'));
});

it('mirrors the horizontal arrows right to left, and keeps Up and Down', async () => {
  const page = await sliders();
  const input = range(page, '.mirrored-thumb');
  input.focus();
  press('ArrowRight', input);
  await page.waitFor(() => expect(state(page)[6]).toBe('#326699'));
  press('ArrowLeft', input);
  press('ArrowLeft', input);
  await page.waitFor(() => expect(state(page)[6]).toBe('#346699'));
  press('ArrowUp', input);
  await page.waitFor(() => expect(state(page)[6]).toBe('#356699'));
  press('ArrowRight', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[6]).toBe('#246699'));
});

it('moves a vertical slider with Up and Down', async () => {
  const page = await sliders();
  const input = range(page, '.alpha-thumb');
  input.focus();
  press('ArrowUp', input);
  await page.waitFor(() => expect(state(page)[2]).toBe('rgba(10, 20, 30, 0.51)'));
  press('ArrowDown', input);
  press('ArrowDown', input);
  await page.waitFor(() => expect(state(page)[2]).toBe('rgba(10, 20, 30, 0.49)'));
  press('ArrowUp', input, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[2]).toBe('rgba(10, 20, 30, 0.59)'));
});

it('does not move with Cmd+Left, Alt+Left or Ctrl+Home, and leaves them to the loader fix', async () => {
  const page = await sliders();
  const input = range(page, '.red-thumb');
  input.focus();
  press('ArrowLeft', input, { metaKey: true });
  press('ArrowLeft', input, { altKey: true });
  press('Home', input, { ctrlKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[1]).toBe('#336699');
});

it('names the color without its alpha', async () => {
  const page = await sliders();
  // Saturation of rgba(51, 102, 153, 0.5) is 50%.
  expect(range(page, '.faded-thumb').getAttribute('aria-valuetext')).toBe('50%, blue');
});
