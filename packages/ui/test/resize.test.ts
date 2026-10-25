// The tests of column resizing follow the tests of ResizableTableContainer in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Resizable from './fixtures/resizable.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function resizable() {
  const page = await mount(Resizable, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof resizable>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as [[string, number][], number, unknown];
}

it('lays out the columns by their widths, with a hidden range input in the resizer', async () => {
  const page = await resizable();
  expect(page.get('.table').hasAttribute('data-resizable')).toBe(true);
  expect(page.get('.col-name').hasAttribute('data-sized')).toBe(true);
  const input = page.get('.resizer-name input');
  expect(input.getAttribute('type')).toBe('range');
  expect(input.getAttribute('aria-label')).toBe('Resizer');
  expect(input.getAttribute('aria-labelledby')).toContain(page.get('.col-name').id);
  expect(input.getAttribute('min')).toBe('100');
  expect(input.getAttribute('max')).toBe('300');
  expect(page.get('.resizer-name').getAttribute('role')).toBe('presentation');
});

it('resizes with the keys after Enter, within the bounds, and Escape ends it', async () => {
  const page = await resizable();
  const input = page.get('.resizer-name input') as HTMLInputElement;
  input.focus();
  press('Enter', input);
  await page.waitFor(() =>
    expect(page.get('.resizer-name').hasAttribute('data-resizing')).toBe(true),
  );
  expect(page.get('.col-name').hasAttribute('data-resizing')).toBe(true);
  press('ArrowRight', input);
  await page.waitFor(() =>
    expect(state(page)[0]).toEqual([
      ['name', 210],
      ['size', 80],
    ]),
  );
  expect(input.getAttribute('aria-valuetext')).toBe('210 pixels');
  // The width stays within the most that the column takes.
  for (let step = 0; step < 12; step++) {
    press('ArrowRight', input);
  }
  await page.waitFor(() => expect(state(page)[0][0]).toEqual(['name', 300]));
  expect(page.get('.resizer-name').getAttribute('data-resizable-direction')).toBe('right');
  press('Escape', input);
  await page.waitFor(() =>
    expect(page.get('.resizer-name').hasAttribute('data-resizing')).toBe(false),
  );
  expect(state(page)[1]).toBe(1);
  // Without a resize, the arrow keys move through the table.
  press('ArrowRight', input);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.col-size')));
});

it('reaches the resizer from the label of its column, and a press on it does not sort', async () => {
  const page = await resizable();
  page.get('.col-size').focus();
  press('ArrowLeft');
  // From the column after, the last control of the column takes the focus.
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.resizer-name input')));
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.label-name')));
  pressWith(page.get('.label-name'));
  await page.waitFor(() =>
    expect(state(page)[2]).toEqual({ column: 'name', direction: 'ascending' }),
  );
  pressWith(page.get('.resizer-name'));
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[2]).toEqual({ column: 'name', direction: 'ascending' });
});
