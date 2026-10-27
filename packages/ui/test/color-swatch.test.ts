// The tests of ColorSwatch.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Pickers from './fixtures/color-swatch-pickers.brm?brumate-server';
import { pressWith } from './interact.ts';
import Colors from './fixtures/colors.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function colors() {
  const page = await mount(Colors, {});
  unmount = page.unmount;
  return page;
}

it('is an image of the color, named by the color', async () => {
  const page = await colors();
  const swatch = page.get('.plain');
  expect(swatch.getAttribute('role')).toBe('img');
  expect(swatch.getAttribute('aria-roledescription')).toBe('color swatch');
  expect(swatch.getAttribute('aria-label')).toBe('red');
  expect(swatch.getAttribute('style')).toContain('rgba(226, 68, 90, 1)');
});

it('takes a name, and names how transparent a color is', async () => {
  const page = await colors();
  expect(page.get('.named').getAttribute('aria-label')).toBe('Ocean');
  expect(page.get('.clear').getAttribute('aria-label')).toBe('green, 75% transparent');
});

it('joins the name of the color and the aria-label of the caller', async () => {
  const page = await colors();
  expect(page.get('.labelled').getAttribute('aria-label')).toBe('red, Brand');
  expect(page.get('.both').getAttribute('aria-label')).toBe('Ocean, Brand');
});

it('follows a color that changes', async () => {
  const page = await colors();
  page.click('.shift');
  await page.waitFor(() => expect(page.get('.plain').getAttribute('aria-label')).toBe('blue'));
  expect(page.get('.plain').getAttribute('style')).toContain('rgba(51, 102, 153, 1)');
});

it('reads the color of an item of a ColorSwatchPicker when it has no color of its own', async () => {
  const page = await mount(Pickers, {});
  unmount = page.unmount;
  expect(page.get('.red-swatch').getAttribute('aria-label')).toBe('red');
  expect(page.get('.blue-swatch').getAttribute('aria-label')).toBe('blue');
  // A press selects the item once the code of the page loads, and the swatch keeps its color.
  pressWith(page.get('.blue'));
  await page.waitFor(() => expect(page.text('.state')).toContain('#00f'));
  expect(page.get('.blue-swatch').getAttribute('aria-label')).toBe('blue');
});
