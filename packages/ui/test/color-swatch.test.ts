// The tests of ColorSwatch follow the tests of ColorSwatch in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
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

it('follows a color that changes', async () => {
  const page = await colors();
  page.click('.shift');
  await page.waitFor(() => expect(page.get('.plain').getAttribute('aria-label')).toBe('blue'));
  expect(page.get('.plain').getAttribute('style')).toContain('rgba(51, 102, 153, 1)');
});
