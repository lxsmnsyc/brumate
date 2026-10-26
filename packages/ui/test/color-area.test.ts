// The tests of ColorArea follow the tests of ColorArea in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ColorAreas from './fixtures/color-areas.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function areas() {
  const page = await mount(ColorAreas, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof areas>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

/** The x input and the y input of an area. */
function inputs(page: Page, selector: string) {
  const [x, y] = page
    .get(selector)
    .querySelectorAll('input[type=range]') as unknown as HTMLInputElement[];
  return { x: x!, y: y! };
}

function slide(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Gives the area a box, which happy-dom does not lay out. */
function layout(area: Element, width = 200, height = 100) {
  area.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

const win = window as unknown as Element;

it('is a group with an input for each axis, saturation and brightness by default', async () => {
  const page = await areas();
  const area = page.get('.hsb');
  expect(area.getAttribute('role')).toBe('group');
  const { x, y } = inputs(page, '.hsb');
  expect(x.min).toBe('0');
  expect(x.max).toBe('100');
  expect(x.value).toBe('50');
  expect(y.value).toBe('80');
  expect(x.getAttribute('aria-label')).toBe('Saturation');
  expect(y.getAttribute('aria-label')).toBe('Brightness');
  expect(x.getAttribute('aria-orientation')).toBe('horizontal');
  expect(y.getAttribute('aria-orientation')).toBe('vertical');
  // Both values and the name of the color, on both inputs.
  const text = 'Saturation 50%, Brightness 80%, blue';
  expect(x.getAttribute('aria-valuetext')).toBe(text);
  expect(y.getAttribute('aria-valuetext')).toBe(text);
});

it('reads the channels it is given, and the hue at 360 degrees', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.rgb');
  expect(x.max).toBe('255');
  expect(x.value).toBe('51');
  expect(y.value).toBe('102');
  expect(x.getAttribute('aria-label')).toBe('Red');
  expect(y.getAttribute('aria-label')).toBe('Green');
  expect(x.getAttribute('aria-valuetext')).toBe('Red 51, Green 102, blue');
});

it('draws the gradient of the two channels and the thumb, for the styles of the caller', async () => {
  const page = await areas();
  const style = page.get('.hsb').getAttribute('style') ?? '';
  // Brightness goes up over saturation, which goes right, at the hue of the color.
  expect(style).toContain('linear-gradient(to top');
  expect(style).toContain('linear-gradient(to right');
  expect(page.get('.hsb-thumb').getAttribute('style')).toContain('hsla(210, 50%, 60%, 1)');
  // Red and green add up with `screen`.
  expect(page.get('.rgb').getAttribute('style')).toContain('screen');
  // The thumb sits at 50% across and 20% from the top.
  const thumb = page.get('.hsb-thumb').getAttribute('style') ?? '';
  expect(thumb).toMatch(/-1:\s*50%;\s*--s-[^:]+-2:\s*20%/);
});

it('moves x with Left and Right and y with Up and Down, on either input', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.hsb');
  x.focus();
  press('ArrowRight', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 51%, 80%)'));
  press('ArrowLeft', x);
  press('ArrowLeft', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 49%, 80%)'));
  // Up on the input of x moves y, as in React Aria.
  press('ArrowUp', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 49%, 81%)'));
  y.focus();
  press('ArrowDown', y);
  press('ArrowDown', y);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 49%, 79%)'));
  press('ArrowRight', y);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 50%, 79%)'));
  expect(x.value).toBe('50');
  expect(y.value).toBe('79');
  await page.waitFor(() => expect(state(page)[5]).toBe('hsb(210, 50%, 79%)'));
});

it('moves y a page with PageUp and PageDown, and a page with Shift and an arrow', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.hsb');
  expect(x.getAttribute('aria-roledescription')).toBe('2D slider');
  expect(y.getAttribute('aria-roledescription')).toBe('2D slider');
  x.focus();
  press('PageUp', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 50%, 90%)'));
  press('PageDown', x);
  press('PageDown', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 50%, 70%)'));
  // Shift with PageUp moves y too, as in React Aria.
  press('PageUp', x, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 50%, 80%)'));
  press('ArrowRight', x, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 60%, 80%)'));
  press('ArrowDown', x, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 60%, 70%)'));
});

it('moves x a page with Home and End, to the ends of its range', async () => {
  const page = await areas();
  const { x } = inputs(page, '.hsb');
  x.focus();
  press('End', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 60%, 80%)'));
  press('Home', x);
  press('Home', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 40%, 80%)'));
  for (let i = 0; i < 5; i++) {
    press('Home', x);
  }
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 0%, 80%)'));
});

it('takes a value from the input of a screen reader, in the format of the value', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.rgb');
  slide(x, 255);
  await page.waitFor(() => expect(state(page)[1]).toBe('#FF6699'));
  slide(y, 0);
  await page.waitFor(() => expect(state(page)[1]).toBe('#FF0099'));
  expect(page.get('.rgb-thumb').getAttribute('style')).toMatch(/-1:\s*100%;\s*--s-[^:]+-2:\s*100%/);
});

it('moves to a press on the area, and y grows upward', async () => {
  const page = await areas();
  layout(page.get('.hsb'));
  // 150 of 200 across is 75%, and 25 of 100 down is 75% up.
  pointer('pointerdown', page.get('.hsb'), { clientX: 150, clientY: 25 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 75%, 75%)'));
  expect(document.activeElement).toBe(inputs(page, '.hsb').x);
  expect(page.get('.hsb-thumb').hasAttribute('data-dragging')).toBe(true);
  pointer('pointermove', win, { clientX: 400, clientY: -50, buttons: 1 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 100%, 100%)'));
  pointer('pointerup', win, { clientX: 400, clientY: -50 });
  await page.waitFor(() =>
    expect(page.get('.hsb-thumb').hasAttribute('data-dragging')).toBe(false),
  );
  await page.waitFor(() => expect(state(page)[5]).toBe('hsb(210, 100%, 100%)'));
});

it('drags the thumb from where it was taken, so it does not jump to the pointer', async () => {
  const page = await areas();
  layout(page.get('.hsb'));
  // The thumb is at (100, 20). The pointer takes it 10 right and 10 below its center.
  pointer('pointerdown', page.get('.hsb-thumb'), { clientX: 110, clientY: 30 });
  await page.waitFor(() => expect(page.get('.hsb-thumb').hasAttribute('data-dragging')).toBe(true));
  expect(state(page)[0]).toBe('hsb(210, 50%, 80%)');
  // 40 right is 20% more, and 20 down is 20% less.
  pointer('pointermove', win, { clientX: 150, clientY: 50, buttons: 1 });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 70%, 60%)'));
  pointer('pointerup', win, { clientX: 150, clientY: 50 });
  await page.waitFor(() =>
    expect(page.get('.hsb-thumb').hasAttribute('data-dragging')).toBe(false),
  );
});

it('mirrors x right to left', async () => {
  const page = await areas();
  const { x } = inputs(page, '.rtl');
  expect(x.value).toBe('20');
  // 20% of saturation sits at 80% from the left.
  expect(page.get('.rtl-thumb').getAttribute('style')).toMatch(/-1:\s*80%;\s*--s-[^:]+-2:\s*50%/);
  x.focus();
  // Left is toward the larger values, and Home goes to the right.
  press('ArrowLeft', x);
  await page.waitFor(() => expect(state(page)[2]).toBe('hsb(0, 21%, 50%)'));
  press('Home', x);
  await page.waitFor(() => expect(state(page)[2]).toBe('hsb(0, 31%, 50%)'));
  layout(page.get('.rtl'));
  pointer('pointerdown', page.get('.rtl'), { clientX: 150, clientY: 50 });
  // 150 of 200 from the left is 25% of saturation.
  await page.waitFor(() => expect(state(page)[2]).toBe('hsb(0, 25%, 50%)'));
  pointer('pointerup', win, {});
});

it('keeps a disabled area still', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.locked');
  expect(x.disabled).toBe(true);
  expect(y.disabled).toBe(true);
  expect(page.get('.locked').hasAttribute('data-disabled')).toBe(true);
  expect(page.get('.locked-thumb').hasAttribute('data-disabled')).toBe(true);
  // Lightness is the vertical axis, and hsl is the space.
  expect(y.getAttribute('aria-label')).toBe('Lightness');
  layout(page.get('.locked'));
  pointer('pointerdown', page.get('.locked'), { clientX: 10, clientY: 10 });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[3]).toBe('hsl(120, 50%, 50%)');
});

it('shows focus on the thumb', async () => {
  const page = await areas();
  const thumb = page.get('.hsb-thumb');
  expect(thumb.hasAttribute('data-focused')).toBe(false);
  inputs(page, '.hsb').y.focus();
  await page.waitFor(() => expect(thumb.hasAttribute('data-focused')).toBe(true));
  inputs(page, '.hsb').y.blur();
  await page.waitFor(() => expect(thumb.hasAttribute('data-focused')).toBe(false));
});

it('posts both values with a form, and gives back the first color on a reset', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.posted');
  expect(x.name).toBe('s');
  expect(y.name).toBe('b');
  slide(x, 40);
  await page.waitFor(() => expect(state(page)[4]).toBe('hsb(0, 40%, 100%)'));
  (page.get('.form') as HTMLFormElement).reset();
  await page.waitFor(() => expect(state(page)[4]).toBe('hsb(0, 100%, 100%)'));
  expect(x.value).toBe('100');
});
