// The tests of ColorArea.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ColorAreas from './fixtures/color-areas.brm?brumate-server';
import { pointer, press, tabbables } from './interact.ts';

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
  expect(x.getAttribute('aria-orientation')).toBe('horizontal');
  expect(y.getAttribute('aria-orientation')).toBe('vertical');
  // The value, the other axis, the third channel and the name of the color.
  expect(x.getAttribute('aria-valuetext')).toBe('Saturation 50%, Brightness 80%, Hue 210°, blue');
  expect(y.getAttribute('aria-valuetext')).toBe('Brightness 80%, Saturation 50%, Hue 210°, blue');
});

it('reads the channels it is given, and the hue at 360 degrees', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.rgb');
  expect(x.max).toBe('255');
  expect(x.value).toBe('51');
  expect(y.value).toBe('102');
  expect(x.getAttribute('aria-valuetext')).toBe('Red 51, Green 102, Blue 153, blue');
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
  // Up on the input of x moves y.
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

it('moves the channel of its input a page with PageUp and PageDown, and a page with Shift and an arrow', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.hsb');
  expect(x.getAttribute('aria-roledescription')).toBe('2D slider');
  expect(y.getAttribute('aria-roledescription')).toBe('2D slider');
  x.focus();
  press('PageUp', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 60%, 80%)'));
  press('PageDown', x);
  press('PageDown', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 40%, 80%)'));
  press('PageUp', y);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 40%, 90%)'));
  press('PageDown', y, { shiftKey: true });
  press('PageDown', y);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 40%, 70%)'));
  press('ArrowRight', x, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 50%, 70%)'));
  press('ArrowDown', x, { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 50%, 60%)'));
});

it('sends Home and End to the ends of the range of the channel of its input', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.hsb');
  x.focus();
  press('End', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 100%, 80%)'));
  press('Home', x);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 0%, 80%)'));
  press('End', y);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 0%, 100%)'));
  press('Home', y);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 0%, 0%)'));
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
  // Left is toward the larger values. Home and End go to the ends of the range, also mirrored.
  press('ArrowLeft', x);
  await page.waitFor(() => expect(state(page)[2]).toBe('hsb(0, 21%, 50%)'));
  press('Home', x);
  await page.waitFor(() => expect(state(page)[2]).toBe('hsb(0, 0%, 50%)'));
  press('End', x);
  await page.waitFor(() => expect(state(page)[2]).toBe('hsb(0, 100%, 50%)'));
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
  expect(y.getAttribute('aria-valuetext')).toMatch(/^Lightness 50%, Saturation 50%, Hue 120°/);
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

it('takes the first two channels of the space by default, and white without a value', async () => {
  const page = await areas();
  // A color of hsb, with no channels given, is hue on x and saturation on y.
  const hsb = inputs(page, '.defaults');
  expect(hsb.x.max).toBe('360');
  expect(hsb.x.value).toBe('210');
  expect(hsb.y.value).toBe('50');
  expect(hsb.x.getAttribute('aria-valuetext')).toBe(
    'Hue 210°, Saturation 50%, Brightness 80%, blue',
  );
  // A hex color is rgb: red on x and green on y.
  const hex = inputs(page, '.hex');
  expect(hex.x.max).toBe('255');
  expect(hex.x.value).toBe('51');
  expect(hex.y.value).toBe('102');
  // The default value is white.
  const empty = inputs(page, '.empty');
  expect(empty.x.value).toBe('255');
  expect(empty.y.value).toBe('255');
  expect(empty.x.getAttribute('aria-valuetext')).toContain('white');
  hsb.x.focus();
  press('ArrowRight', hsb.x);
  await page.waitFor(() => expect(state(page)[6]).toBe('hsb(211, 50%, 80%)'));
  press('End', hex.x);
  await page.waitFor(() => expect(state(page)[7]).toBe('#FF6699'));
});

it('names the color without its alpha', async () => {
  const page = await areas();
  const { x } = inputs(page, '.translucent');
  expect(x.getAttribute('aria-valuetext')).toBe('Saturation 67%, Brightness 60%, Hue 210°, blue');
});

it('has one tab stop, and hides the input of y from screen readers until it has focus', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.hsb');
  expect(x.hasAttribute('tabindex')).toBe(false);
  expect(x.hasAttribute('aria-hidden')).toBe(false);
  expect(y.getAttribute('tabindex')).toBe('-1');
  expect(y.getAttribute('aria-hidden')).toBe('true');
  expect(tabbables(page.get('.hsb'))).toEqual([x]);
  // Up on x moves y, and the focus follows it. Both inputs are then exposed, until the focus
  // leaves.
  x.focus();
  await page.waitFor(() => expect(y.getAttribute('aria-hidden')).toBe('true'));
  press('ArrowUp', x);
  await page.waitFor(() => expect(document.activeElement).toBe(y));
  await page.waitFor(() => expect(y.hasAttribute('aria-hidden')).toBe(false));
  expect(y.hasAttribute('tabindex')).toBe(false);
  expect(x.getAttribute('tabindex')).toBe('-1');
  expect(x.hasAttribute('aria-hidden')).toBe(false);
  // When the focus leaves, the input that was used last stays the tab stop, and
  // the other one is hidden again.
  y.blur();
  await page.waitFor(() => expect(x.getAttribute('aria-hidden')).toBe('true'));
  expect(x.getAttribute('tabindex')).toBe('-1');
  expect(y.hasAttribute('tabindex')).toBe(false);
  expect(y.hasAttribute('aria-hidden')).toBe(false);
});

it('says less after a change from the keys', async () => {
  const page = await areas();
  const { x, y } = inputs(page, '.hsb');
  x.focus();
  press('ArrowRight', x);
  await page.waitFor(() => expect(x.getAttribute('aria-valuetext')).toBe('Saturation 51%, blue'));
  expect(y.getAttribute('aria-valuetext')).toBe('Brightness 80%, blue');
  x.blur();
  await page.waitFor(() =>
    expect(x.getAttribute('aria-valuetext')).toBe('Saturation 51%, Brightness 80%, Hue 210°, blue'),
  );
});

it('names the inputs, from the label of the caller', async () => {
  const page = await areas();
  // Without a label, the inputs are the color picker, and the group has no name.
  const plain = inputs(page, '.hsb');
  expect(plain.x.getAttribute('aria-label')).toBe('Color picker');
  expect(plain.y.getAttribute('aria-label')).toBe('Color picker');
  expect(page.get('.hsb').hasAttribute('aria-label')).toBe(false);
  expect(page.get('.hsb').hasAttribute('aria-labelledby')).toBe(false);
  // With an aria-label, the group and both inputs say it, and `Color picker`.
  const named = inputs(page, '.named');
  expect(page.get('.named').getAttribute('aria-label')).toBe('Fill, Color picker');
  expect(named.x.getAttribute('aria-label')).toBe('Fill, Color picker');
  expect(named.y.getAttribute('aria-label')).toBe('Fill, Color picker');
  // With an aria-labelledby, the group and the inputs add themselves to the names.
  const linked = inputs(page, '.linked');
  const group = page.get('.linked');
  expect(group.getAttribute('aria-labelledby')).toBe(`${group.id} outside`);
  expect(linked.x.getAttribute('aria-labelledby')).toBe(`${linked.x.id} outside`);
  expect(linked.y.getAttribute('aria-labelledby')).toBe(`${linked.y.id} outside`);
});

it('skips a press with Alt, Ctrl or Meta', async () => {
  const page = await areas();
  layout(page.get('.hsb'));
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
    pointer('pointerdown', page.get('.hsb'), { clientX: 150, clientY: 25, [modifier]: true });
  }
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[0]).toBe('hsb(210, 50%, 80%)');
  expect(page.get('.hsb-thumb').hasAttribute('data-dragging')).toBe(false);
  pointer('pointerdown', page.get('.hsb-thumb'), { clientX: 110, clientY: 30, altKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(page.get('.hsb-thumb').hasAttribute('data-dragging')).toBe(false);
});

// A key that prevent names alone is prevented only while Ctrl, Meta and Alt are up, so the
// shortcuts of the browser keep their default.
it('leaves Cmd+Left, Alt+Left and Ctrl+Home to the browser', async () => {
  const page = await areas();
  const { x } = inputs(page, '.hsb');
  x.focus();
  for (const init of [
    { key: 'ArrowLeft', metaKey: true },
    { key: 'ArrowLeft', altKey: true },
    { key: 'Home', ctrlKey: true },
  ]) {
    const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
    x.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
});

it('does not move with Cmd+Left, Alt+Left or Ctrl+Home', async () => {
  const page = await areas();
  const { x } = inputs(page, '.hsb');
  x.focus();
  press('ArrowLeft', x, { metaKey: true });
  press('ArrowLeft', x, { altKey: true });
  press('Home', x, { ctrlKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[0]).toBe('hsb(210, 50%, 80%)');
});
