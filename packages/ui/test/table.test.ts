// The tests of Table follow the tests of Table in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Tables from './fixtures/tables.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function tables() {
  const page = await mount(Tables, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof tables>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function names(page: Page) {
  return [...page.get('.body').querySelectorAll('[role=rowheader]')].map(
    (cell) => cell.textContent,
  );
}

it('is a grid of a header row and rows, whose cells in the row header column name them', async () => {
  const page = await tables();
  const table = page.get('.table');
  expect(table.tagName).toBe('TABLE');
  expect(table.getAttribute('role')).toBe('grid');
  expect(table.getAttribute('aria-multiselectable')).toBe('true');
  expect(page.get('.head').getAttribute('role')).toBe('rowgroup');
  expect(page.get('.col-name').getAttribute('role')).toBe('columnheader');
  expect(page.get('.col-name').getAttribute('aria-sort')).toBe('none');
  expect(page.get('.col-edit').hasAttribute('aria-sort')).toBe(false);
  const row = page.get('.row-notes');
  expect(row.tagName).toBe('TR');
  expect(row.getAttribute('aria-selected')).toBe('false');
  expect(page.get('.cell-name-notes').tagName).toBe('TH');
  expect(page.get('.cell-name-notes').getAttribute('role')).toBe('rowheader');
  expect(page.get('.cell-size-notes').getAttribute('role')).toBe('gridcell');
  expect(page.get('.row-music').getAttribute('aria-disabled')).toBe('true');
});

it('moves between rows and cells with the arrow keys, and up to the column headers', async () => {
  const page = await tables();
  page.get('.table').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  press('ArrowRight');
  // The first cell holds a control, which takes the focus.
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.check-notes input')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.cell-name-notes')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.cell-size-notes')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.cell-size-photo')));
  press('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.cell-size-notes')));
  press('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.col-size')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.col-edit')));
  // The columns go round.
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.col-select')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.check-notes input')));
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.edit-notes')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.edit-notes')));
});

it('selects rows with Space, a press and a Checkbox, and all of them from the header', async () => {
  const page = await tables();
  page.get('.table').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  press(' ');
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes']));
  // The box of the header is mixed while some rows are selected.
  await page.waitFor(() =>
    expect(page.get('.select-all').hasAttribute('data-indeterminate')).toBe(true),
  );
  pressWith(page.get('.cell-size-photo'));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes', 'photo']));
  pressWith(page.get('.edit-photo'));
  await page.waitFor(() => expect(state(page)[3]).toBe(1));
  expect(state(page)[0]).toEqual(['notes', 'photo']);
  page.get('.check-photo input').click();
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes']));
  // The box of the header selects every row that can be selected, then none.
  page.get('.select-all input').click();
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes', 'photo']));
  await page.waitFor(() =>
    expect((page.get('.select-all input') as HTMLInputElement).checked).toBe(true),
  );
  page.get('.select-all input').click();
  await page.waitFor(() => expect(state(page)[0]).toEqual([]));
});

it('sorts by a column with a press or Enter, ascending then descending', async () => {
  const page = await tables();
  pressWith(page.get('.col-size'));
  await page.waitFor(() => expect(names(page)).toEqual(['notes.txt', 'music.mp3', 'photo.jpg']));
  expect(page.get('.col-size').getAttribute('aria-sort')).toBe('ascending');
  expect(page.get('.col-size').getAttribute('data-sort-direction')).toBe('ascending');
  pressWith(page.get('.col-size'));
  await page.waitFor(() => expect(names(page)).toEqual(['photo.jpg', 'music.mp3', 'notes.txt']));
  expect(page.get('.col-size').getAttribute('aria-sort')).toBe('descending');
  page.get('.col-name').focus();
  press('Enter');
  await page.waitFor(() => expect(names(page)).toEqual(['music.mp3', 'notes.txt', 'photo.jpg']));
  expect(state(page)[1]).toEqual({ column: 'name', direction: 'ascending' });
  expect(page.get('.col-size').getAttribute('aria-sort')).toBe('none');
});

it('renders the cells of a row that the browser adds in their columns', async () => {
  const page = await tables();
  pressWith(page.get('.add'));
  await page.waitFor(() =>
    expect(page.get('.cell-name-video').getAttribute('role')).toBe('rowheader'),
  );
  expect(page.get('.cell-size-video').getAttribute('role')).toBe('gridcell');
  pressWith(page.get('.cell-size-video'));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['video']));
});

it('acts on a row with Enter and a press when nothing is selectable', async () => {
  const page = await tables();
  page.get('.acting').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.inbox')));
  press('Enter');
  await page.waitFor(() => expect(state(page)[2]).toEqual(['inbox']));
  pressWith(page.get('.sent'));
  await page.waitFor(() => expect(state(page)[2]).toEqual(['inbox', 'sent']));
});
