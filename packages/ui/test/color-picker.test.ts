// The tests of ColorPicker follow the tests of ColorPicker in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Pickers from './fixtures/color-pickers.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function pickers() {
  const page = await mount(Pickers, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof pickers>>;

/** The caller's color, the changes that onChange got, and the own color of one slider. */
function state(page: Page) {
  return JSON.parse(page.text('.state')) as [string, string[], string];
}

function slide(input: HTMLInputElement, value: number) {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

it('shows its color in every part', async () => {
  const page = await pickers();
  const [x, y] = page
    .get('.area')
    .querySelectorAll('input[type=range]') as unknown as HTMLInputElement[];
  expect(x!.value).toBe('50');
  expect(y!.value).toBe('80');
  expect((page.get('.slider input[type=range]') as HTMLInputElement).value).toBe('210');
  expect((page.get('.field-input') as HTMLInputElement).value).toBe('#6699CC');
  expect(page.get('.swatch').getAttribute('aria-label')).toBe('blue');
  // No swatch of the list has the color, so none is selected.
  expect(page.get('.red').getAttribute('aria-selected')).not.toBe('true');
});

it('shows a change of the area in the slider, the field, the swatch and the caller', async () => {
  const page = await pickers();
  const [x] = page
    .get('.area')
    .querySelectorAll('input[type=range]') as unknown as HTMLInputElement[];
  slide(x!, 100);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(210, 100%, 80%)'));
  expect((page.get('.field-input') as HTMLInputElement).value).toBe('#0066CC');
  expect(page.get('.swatch').getAttribute('aria-label')).toContain('blue');
  expect((page.get('.slider input[type=range]') as HTMLInputElement).value).toBe('210');
  // The format of the picker stays.
  expect(state(page)[1]).toEqual(['hsb(210, 100%, 80%)']);
});

it('shows a change of the slider in the area and the field', async () => {
  const page = await pickers();
  slide(page.get('.slider input[type=range]') as HTMLInputElement, 120);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(120, 50%, 80%)'));
  const [x] = page
    .get('.area')
    .querySelectorAll('input[type=range]') as unknown as HTMLInputElement[];
  expect(x!.value).toBe('50');
  expect((page.get('.field-input') as HTMLInputElement).value).toBe('#66CC66');
});

it('shows a change of the field in the others, in its format', async () => {
  const page = await pickers();
  type(page.get('.field-input') as HTMLInputElement, '#ff0000');
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(0, 100%, 100%)'));
  expect((page.get('.slider input[type=range]') as HTMLInputElement).value).toBe('0');
  expect(page.get('.red').getAttribute('aria-selected')).toBe('true');
});

it('keeps its color when the field is cleared', async () => {
  const page = await pickers();
  type(page.get('.field-input') as HTMLInputElement, '');
  await page.waitFor(() =>
    expect((page.get('.field-input') as HTMLInputElement).value).toBe('#6699CC'),
  );
  expect(state(page)[0]).toBe('hsb(210, 50%, 80%)');
  expect(state(page)[1]).toEqual([]);
});

it('takes the pick of the swatch list', async () => {
  const page = await pickers();
  page.click('.green');
  await page.waitFor(() => expect(state(page)[0]).toBe('#00ff00'));
  expect((page.get('.field-input') as HTMLInputElement).value).toBe('#00FF00');
  expect(page.get('.green').getAttribute('aria-selected')).toBe('true');
  expect(state(page)[1]).toEqual(['#00ff00']);
});

it('keeps a part with its own value apart from the picker', async () => {
  const page = await pickers();
  const own = page.get('.own-slider input[type=range]') as HTMLInputElement;
  expect(own.value).toBe('0');
  slide(own, 255);
  await page.waitFor(() => expect(state(page)[2]).toBe('#00FFFF'));
  // The picker did not change.
  expect(state(page)[0]).toBe('hsb(210, 50%, 80%)');
  expect(state(page)[1]).toEqual([]);
  // A change of the picker does not reach the part.
  slide(page.get('.slider input[type=range]') as HTMLInputElement, 120);
  await page.waitFor(() => expect(state(page)[0]).toBe('hsb(120, 50%, 80%)'));
  expect(own.value).toBe('255');
  // A swatch with its own color keeps it.
  expect(page.get('.own-swatch').getAttribute('aria-label')).toContain('blue');
});

it('starts its own state with value=(x)', async () => {
  const page = await pickers();
  expect(page.get('.solo').getAttribute('aria-label')).toBe('blue');
});
