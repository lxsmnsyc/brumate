// The tests of ColorSwatchPicker.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Pickers from './fixtures/color-swatch-pickers.brm?brumate-server';
import { pointer, press, pressWith } from './interact.ts';

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

/** The grid value, the stack value, and the values that onChange got. */
function state(page: Page) {
  return JSON.parse(page.text('.state')) as [string, string, string[]];
}

/** Lays the grid out as two rows of two, which happy-dom does not do. */
function layout(page: Page) {
  const spots: Record<string, [number, number]> = {
    '.red': [0, 0],
    '.green': [20, 0],
    '.blue': [0, 20],
    '.yellow': [20, 20],
  };
  for (const [selector, [x, y]] of Object.entries(spots)) {
    page.get(selector).getBoundingClientRect = () =>
      ({ left: x, top: y, width: 20, height: 20, right: x + 20, bottom: y + 20, x, y }) as DOMRect;
  }
}

it('is a listbox of options that hold a swatch of their color', async () => {
  const page = await pickers();
  const grid = page.get('.grid');
  expect(grid.getAttribute('role')).toBe('listbox');
  expect(grid.getAttribute('aria-label')).toBe('Palette');
  expect(grid.getAttribute('data-layout')).toBe('grid');
  expect(page.get('.stack').getAttribute('data-layout')).toBe('stack');
  expect(page.get('.stack').getAttribute('aria-label')).toBe('Color swatch picker');
  expect(page.get('.green').getAttribute('role')).toBe('option');
  expect(page.get('.green').getAttribute('aria-label')).toBe(null);
  // The swatch reads the color of its item.
  expect(page.get('.green-swatch').getAttribute('aria-label')).toBe('green');
  expect(page.get('.green-swatch').getAttribute('style')).toContain('rgba(0, 255, 0, 1)');
});

it('selects the item whose color is the value, whatever the format', async () => {
  const page = await pickers();
  // The value is rgb(255, 0, 0), and the item is #f00.
  expect(page.get('.red').getAttribute('aria-selected')).toBe('true');
  expect(page.get('.red').hasAttribute('data-selected')).toBe(true);
  expect(page.get('.green').getAttribute('aria-selected')).toBe('false');
  expect(page.get('.s-red').getAttribute('aria-selected')).toBe('true');
  expect(page.get('.s-blue').hasAttribute('data-selected')).toBe(false);
  expect(page.get('.s-gray').hasAttribute('data-disabled')).toBe(true);
  expect(page.get('.s-gray').getAttribute('aria-disabled')).toBe('true');
});

it('selects an item by a press, and gives the format of the item', async () => {
  const page = await pickers();
  page.get('.green').focus();
  press('Enter');
  await page.waitFor(() => expect(state(page)[0]).toBe('rgb(0, 255, 0)'));
  expect(state(page)[2]).toEqual(['rgb(0, 255, 0)']);
  expect(page.get('.green').getAttribute('aria-selected')).toBe('true');
  expect(page.get('.red').getAttribute('aria-selected')).toBe('false');
  page.click('.yellow');
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(60, 100%, 50%)'));
  page.click('.blue');
  await page.waitFor(() => expect(state(page)[0]).toBe('#00f'));
});

it('keeps the selection when the selected item is pressed again', async () => {
  const page = await pickers();
  page.click('.green');
  await page.waitFor(() => expect(state(page)[2]).toHaveLength(1));
  press('Enter', page.get('.green'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(state(page)[2]).toHaveLength(1);
  expect(page.get('.green').getAttribute('aria-selected')).toBe('true');
});

it('keeps its own value when it is not bound', async () => {
  const page = await pickers();
  expect(page.get('.o-green').getAttribute('aria-selected')).toBe('true');
  page.click('.o-red');
  await page.waitFor(() => expect(page.get('.o-red').getAttribute('aria-selected')).toBe('true'));
  expect(page.get('.o-green').getAttribute('aria-selected')).toBe('false');
});

it('passes its focus on to the selected item, and Tab stops at it once', async () => {
  const page = await pickers();
  const grid = page.get('.grid');
  expect(grid.getAttribute('tabindex')).toBe('0');
  grid.focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.red')));
  await page.waitFor(() => expect(grid.tabIndex).toBe(-1));
  expect(page.get('.red').hasAttribute('data-focused')).toBe(true);
  page.get('.before').focus();
  await page.waitFor(() => expect(grid.tabIndex).toBe(0));
  expect(page.get('.red').hasAttribute('data-focused')).toBe(false);
});

it('moves in two dimensions in the grid, and the selection follows focus', async () => {
  const page = await pickers();
  layout(page);
  page.get('.red').focus();
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.green')));
  await page.waitFor(() => expect(state(page)[0]).toBe('rgb(0, 255, 0)'));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.yellow')));
  await page.waitFor(() => expect(state(page)[0]).toBe('hsl(60, 100%, 50%)'));
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.blue')));
  press('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.red')));
  expect(state(page)[0]).toBe('#f00');
  // Up from the first row stays.
  press('ArrowUp');
  expect(document.activeElement).toBe(page.get('.red'));
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.yellow')));
  press('Home');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.red')));
});

it('moves up and down in the stack, and skips a disabled item', async () => {
  const page = await pickers();
  expect(state(page)[1]).toBe('#ff0000');
  page.get('.s-red').focus();
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.s-blue')));
  await page.waitFor(() => expect(state(page)[1]).toBe('#0000ff'));
  expect(page.get('.s-blue').getAttribute('aria-selected')).toBe('true');
  expect(page.get('.s-red').getAttribute('aria-selected')).toBe('false');
  press('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.s-red')));
  await page.waitFor(() => expect(state(page)[1]).toBe('#ff0000'));
  // Left and right do nothing in a stack.
  press('ArrowRight');
  expect(document.activeElement).toBe(page.get('.s-red'));
});

it('does not select a disabled item by Space, Enter or a click', async () => {
  const page = await pickers();
  const gray = page.get('.s-gray');
  // A click can focus a disabled item, so the keys must still not select it.
  gray.focus();
  press(' ');
  press('Enter');
  pressWith(gray);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(state(page)[1]).toBe('#ff0000');
  expect(gray.getAttribute('aria-selected')).toBe('false');
  expect(page.get('.s-red').getAttribute('aria-selected')).toBe('true');
});

it('moves to the item whose name starts with the typed letters', async () => {
  const page = await pickers();
  page.get('.red').focus();
  press('g');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.green')));
  await page.waitFor(() => expect(state(page)[0]).toBe('rgb(0, 255, 0)'));
  // The letters add up: "gr" still matches green, and a letter with no match stays.
  press('r');
  press('x');
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(document.activeElement).toBe(page.get('.green'));
  expect(state(page)[0]).toBe('rgb(0, 255, 0)');
});

it('moves by a page in the grid', async () => {
  const page = await pickers();
  layout(page);
  const grid = page.get('.grid');
  Object.defineProperty(grid, 'clientHeight', { value: 20, configurable: true });
  page.get('.red').focus();
  press('PageDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.yellow')));
  press('PageUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.red')));
});

it('turns the arrow keys around right to left', async () => {
  const page = await pickers();
  const more = () => JSON.parse(page.text('.more')) as [string, string];
  page.get('.r-red').focus();
  // Left is the next item.
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.r-green')));
  await page.waitFor(() => expect(more()[0]).toBe('#00ff00'));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.r-red')));
  await page.waitFor(() => expect(more()[0]).toBe('#ff0000'));
});

it('selects nothing for a value that is no color, and still takes focus and a pick', async () => {
  const page = await pickers();
  const more = () => JSON.parse(page.text('.more')) as [string, string];
  const bad = page.get('.bad');
  expect(page.get('.b-red').getAttribute('aria-selected')).toBe('false');
  expect(page.get('.b-green').getAttribute('aria-selected')).toBe('false');
  bad.focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.b-red')));
  press('ArrowRight');
  await page.waitFor(() => expect(more()[1]).toBe('#00ff00'));
  expect(page.get('.b-green').getAttribute('aria-selected')).toBe('true');
});

it('shows data-focus-visible for a key, and not for a press', async () => {
  const page = await pickers();
  layout(page);
  page.get('.red').focus();
  press('ArrowRight');
  await page.waitFor(() =>
    expect(page.get('.green').hasAttribute('data-focus-visible')).toBe(true),
  );
  // A press takes the ring away, and a key brings it back.
  pointer('pointerdown', page.get('.green'));
  await page.waitFor(() =>
    expect(page.get('.green').hasAttribute('data-focus-visible')).toBe(false),
  );
  expect(page.get('.green').hasAttribute('data-focused')).toBe(true);
  press('ArrowRight');
  await page.waitFor(() => expect(page.get('.blue').hasAttribute('data-focus-visible')).toBe(true));
});
