// The tests of GridList follow the tests of GridList in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import GridLists from './fixtures/gridlists.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function gridlists() {
  const page = await mount(GridLists, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof gridlists>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

it('is a grid of rows, each with one cell', async () => {
  const page = await gridlists();
  const grid = page.get('.grid');
  expect(grid.getAttribute('role')).toBe('grid');
  expect(grid.getAttribute('aria-multiselectable')).toBe('true');
  const row = page.get('.row-notes');
  expect(row.getAttribute('role')).toBe('row');
  expect(row.firstElementChild!.getAttribute('role')).toBe('gridcell');
  expect(row.getAttribute('aria-selected')).toBe('false');
  expect(page.get('.row-music').getAttribute('aria-disabled')).toBe('true');
  expect(page.get('.inbox').hasAttribute('aria-selected')).toBe(false);
});

it('moves between rows with Up and Down, and through a row with Left and Right', async () => {
  const page = await gridlists();
  page.get('.grid').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-photos')));
  // The disabled row is skipped, and the list does not go round.
  press('ArrowDown');
  await new Promise((done) => setTimeout(done, 50));
  expect(document.activeElement).toBe(page.get('.row-photos'));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.check-photos input')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.edit-photos')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-photos')));
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.edit-photos')));
  press('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
});

it('selects with Space, a press and the Checkbox, but not with a press of a Button', async () => {
  const page = await gridlists();
  page.get('.grid').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  press(' ');
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes']));
  await page.waitFor(() =>
    expect((page.get('.check-notes input') as HTMLInputElement).checked).toBe(true),
  );
  pressWith(page.get('.edit-photos'));
  await page.waitFor(() => expect(state(page)[2]).toBe(1));
  expect(state(page)[0]).toEqual(['notes']);
  page.get('.check-photos input').click();
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes', 'photos']));
  pressWith(page.get('.row-notes'));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['photos']));
});

it('acts on a row with Enter and a press when nothing is selectable', async () => {
  const page = await gridlists();
  page.get('.actions').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.inbox')));
  press('Enter');
  await page.waitFor(() => expect(state(page)[1]).toEqual(['inbox']));
  pressWith(page.get('.sent'));
  await page.waitFor(() => expect(state(page)[1]).toEqual(['inbox', 'sent']));
});

it('takes Ctrl+A and Escape from a control in a row, and leaves disabled rows out', async () => {
  const page = await gridlists();
  const box = page.get('.check-notes input');
  box.focus();
  press('a', box, { ctrlKey: true });
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes', 'photos']));
  press('Escape', box);
  await page.waitFor(() => expect(state(page)[0]).toEqual([]));
});

it('extends a range with Shift from the row that has focus', async () => {
  const page = await gridlists();
  page.get('.grid').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  press('ArrowDown', page.get('.row-notes'), { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes', 'photos']));
});

/** Sends a key to an element and says whether the page keeps its default, such as a scroll. */
function prevented(target: Element, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

it('prevents Space, Enter, Home and End on a row, at once', async () => {
  const page = await gridlists();
  // The listeners start with the page.
  await new Promise((done) => setTimeout(done, 50));
  const row = page.get('.row-notes');
  expect(prevented(row, ' ')).toBe(true);
  expect(prevented(row, 'Enter')).toBe(true);
  expect(prevented(row, 'Home')).toBe(true);
  expect(prevented(row, 'End')).toBe(true);
  // The keys of a control in a row are its own, such as Enter on a Button.
  expect(prevented(page.get('.edit-notes'), 'Enter')).toBe(false);
});

it('leaves the keys of a text field in a row to the field', async () => {
  const page = await gridlists();
  await new Promise((done) => setTimeout(done, 50));
  const field = page.get('.field');
  expect(prevented(field, ' ')).toBe(false);
  expect(prevented(field, 'Enter')).toBe(false);
  expect(prevented(field, 'Home')).toBe(false);
  expect(prevented(field, 'End')).toBe(false);
});

it('is a tab stop again when the row that had focus is removed', async () => {
  const page = await gridlists();
  const grid = page.get('.fields');
  await new Promise((done) => setTimeout(done, 50));
  page.get('.field').focus();
  await page.waitFor(() => expect(grid.tabIndex).toBe(-1));
  page.get('.name').remove();
  await page.waitFor(() => expect(grid.tabIndex).toBe(0));
});
