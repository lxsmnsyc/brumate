// The parts keep a color at full precision, which hex, rgb and hsl text cannot hold: the hue of a
// gray, and the saturation of black. They give back the format of the caller.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Precision from './fixtures/color-precision.brm?brumate-server';
import { channelValue, parseColor } from '../src/color.ts';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function precision() {
  const page = await mount(Precision, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof precision>>;

const NAMES = ['gray', 'near', 'wheel', 'area', 'hslArea', 'hexa', 'faint', 'picked', 'hex', 'hue'];

function state(page: Page): Record<string, string | null> {
  const values = JSON.parse(page.text('.state')) as (string | null)[];
  return Object.fromEntries(NAMES.map((name, index) => [name, values[index]!]));
}

function changes(page: Page) {
  return JSON.parse(page.text('.changes')) as string[];
}

function inputs(page: Page, selector: string) {
  return [...page.get(selector).querySelectorAll('input[type=range]')] as HTMLInputElement[];
}

function slide(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function blur(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent('blur'));
}

function wait(ms = 60) {
  return new Promise((done) => setTimeout(done, ms));
}

it('moves the hue of a gray slider, which has none in hex', async () => {
  const page = await precision();
  const [input] = inputs(page, '.gray');
  // The thumb and the screen reader keep the hue, which hex cannot hold for a gray.
  const text = () => input!.getAttribute('aria-valuetext');
  slide(input!, 120);
  await page.waitFor(() => expect(text()).toContain('120°'));
  await wait();
  expect(text()).toContain('120°');
  expect(page.get('.gray [data-color-thumb]').getAttribute('style')).toMatch(/33\.33\d*%/);
  slide(input!, 200);
  await page.waitFor(() => expect(text()).toContain('200°'));
  // Nothing outside changed, since the color is the same.
  expect(state(page).gray).toBe('#808080');
  expect(changes(page).filter((change) => change.startsWith('gray'))).toEqual([]);
});

it('moves the hue of a near gray in steps of one, up to 360', async () => {
  const page = await precision();
  const [input] = inputs(page, '.near');
  input!.focus();
  const text = () => input!.getAttribute('aria-valuetext');
  slide(input!, 10);
  await page.waitFor(() => expect(text()).toContain('10°'));
  slide(input!, 11);
  await page.waitFor(() => expect(text()).toContain('11°'));
  slide(input!, 12);
  await page.waitFor(() => expect(text()).toContain('12°'));
  await wait();
  expect(text()).toContain('12°');
  slide(input!, 360);
  await wait();
  expect(input!.getAttribute('aria-valuetext')).toContain('360°');
});

it('moves the hue of a gray wheel with the keys', async () => {
  const page = await precision();
  const [input] = inputs(page, '.wheel');
  input!.focus();
  press('ArrowRight', input!);
  await wait();
  press('ArrowRight', input!);
  await wait();
  press('ArrowRight', input!, { shiftKey: true });
  await wait();
  // Shift moves to a multiple of the page.
  expect(input!.value).toBe('15');
  expect(state(page).wheel).toBe('#808080');
});

it('keeps the hue of an area dragged to saturation 0 and back', async () => {
  const page = await precision();
  const [x] = inputs(page, '.area');
  slide(x!, 0);
  await page.waitFor(() => expect(state(page).area).toBe('#999999'));
  slide(x!, 67);
  await page.waitFor(() => expect(state(page).area).not.toBe('#999999'));
  expect(channelValue(parseColor(state(page).area!), 'hue')).toBeCloseTo(210, 0);
});

it('keeps the saturation of an area on an hsl value dragged to brightness 0 and back', async () => {
  const page = await precision();
  const [, y] = inputs(page, '.hsl-area');
  slide(y!, 0);
  await page.waitFor(() => expect(state(page).hslArea).toBe('hsl(200, 0%, 0%)'));
  slide(y!, 75);
  await page.waitFor(() => expect(state(page).hslArea).toBe('hsl(200, 50%, 50%)'));
});

it('shares one color between the parts of a hex picker', async () => {
  const page = await precision();
  const [hue] = inputs(page, '.p-hue');
  const [x, y] = inputs(page, '.p-area');
  slide(hue!, 120);
  await wait();
  expect(hue!.value).toBe('120');
  slide(x!, 50);
  slide(y!, 50);
  await page.waitFor(() => expect(state(page).picked).toBe('#408040'));
  expect(hue!.value).toBe('120');
  slide(x!, 0);
  await wait();
  slide(x!, 50);
  await wait();
  expect(hue!.value).toBe('120');
  expect(state(page).picked).toBe('#408040');
  expect((page.get('.p-input') as HTMLInputElement).value).toBe('#408040');
});

it('follows a value that changes from outside the picker', async () => {
  const page = await precision();
  const field = page.get('.p-input') as HTMLInputElement;
  type(field, '#ff0000');
  field.dispatchEvent(new Event('change', { bubbles: true }));
  blur(field);
  await page.waitFor(() => expect(state(page).picked).toBe('#FF0000'));
  expect(inputs(page, '.p-hue')[0]!.value).toBe('0');
});

it('keeps the alpha of hexa as it is', async () => {
  const page = await precision();
  slide(inputs(page, '.hexa')[0]!, 17);
  await page.waitFor(() => expect(state(page).hexa).toBe('#11BBCCDD'));
  slide(inputs(page, '.faint')[0]!, 255);
  await page.waitFor(() => expect(state(page).faint).toBe('#FF000001'));
});

it('does not write or fire when a field is blurred without typing', async () => {
  const page = await precision();
  for (const selector of ['.hex-input', '.hue-input']) {
    const input = page.get(selector) as HTMLInputElement;
    input.focus();
    blur(input);
  }
  await wait();
  expect(state(page).hex).toBe('#e2445a');
  expect(state(page).hue).toBe('hsl(200, 33%, 47%)');
  expect(changes(page)).toEqual([]);
});

it('keeps the caller string when typed text is the same color in another case', async () => {
  const page = await precision();
  const input = page.get('.hex-input') as HTMLInputElement;
  input.focus();
  type(input, '#E2445A');
  blur(input);
  await wait();
  expect(state(page).hex).toBe('#e2445a');
  expect(changes(page)).toEqual([]);
  type(input, '#E2445B');
  blur(input);
  await page.waitFor(() => expect(state(page).hex).toBe('#E2445B'));
  expect(changes(page)).toEqual(['hex:#E2445B']);
});

it('follows a value that the caller sets, and keeps its own hue when the color is the same', async () => {
  const page = await precision();
  const [input] = inputs(page, '.gray');
  const text = () => input!.getAttribute('aria-valuetext');
  slide(input!, 120);
  await page.waitFor(() => expect(text()).toContain('120°'));
  // The same color from outside does not reset the hue.
  page.click('.gray-again');
  await wait();
  expect(text()).toContain('120°');
  page.click('.red');
  await page.waitFor(() => expect(text()).toContain('0°'));
  await page.waitFor(() => expect(state(page).gray).toBe('#ff0000'));
});
