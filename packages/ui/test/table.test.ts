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
  // The columns go round. A column with a control gives it the focus.
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.select-all input')));
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

it('extends a range with Shift from the row that has focus', async () => {
  const page = await tables();
  page.get('.row-notes').focus();
  press('ArrowDown', page.get('.row-notes'), { shiftKey: true });
  await page.waitFor(() => expect(state(page)[0]).toEqual(['notes', 'photo']));
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

function picked(page: Page) {
  return JSON.parse(page.text('.picked')) as [string[], string[], string];
}

function box(page: Page, name: string) {
  return page.get(`.${name}-all input`) as HTMLInputElement;
}

it('shows the box of the header from the rows and the selection when it renders', async () => {
  const page = await tables();
  // Every row that can be selected is, and the disabled row is not counted.
  await page.waitFor(() => expect(box(page, 'pick').checked).toBe(true));
  expect(page.get('.pick-all').hasAttribute('data-indeterminate')).toBe(false);
  // A new row that is not selected makes it mixed.
  pressWith(page.get('.pick-add'));
  await page.waitFor(() =>
    expect(page.get('.pick-all').hasAttribute('data-indeterminate')).toBe(true),
  );
  // Removing a row that was selected keeps the rest.
  pressWith(page.get('.pick-remove'));
  await page.waitFor(() =>
    expect(page.get('.pick-all').hasAttribute('data-indeterminate')).toBe(true),
  );
  expect(picked(page)[0]).toEqual(['a', 'b']);
});

it('leaves a disabled row out of select all, and respects disallowEmptySelection', async () => {
  const page = await tables();
  box(page, 'pick').click();
  await page.waitFor(() => expect(picked(page)[0]).toEqual([]));
  box(page, 'pick').click();
  await page.waitFor(() => expect(picked(page)[0]).toEqual(['a', 'b']));
  page.get('.pick-a').focus();
  press('a', page.get('.pick-a'), { ctrlKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(picked(page)[0]).toEqual(['a', 'b']);
  // The table cannot be emptied from the header or Ctrl+A.
  box(page, 'keep').click();
  await page.waitFor(() => expect(picked(page)[1]).toEqual(['x', 'y']));
  box(page, 'keep').click();
  await new Promise((done) => setTimeout(done, 50));
  expect(picked(page)[1]).toEqual(['x', 'y']);
});

it('moves by pages, keeps Home and End of a field, and prevents the keys it handles', async () => {
  const page = await tables();
  page.get('.table').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  press('PageDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-photo')));
  press('PageUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-notes')));
  const keys = ['Home', 'End', ' '];
  for (const key of keys) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    await page.waitFor(() => expect(event.defaultPrevented).toBe(true));
  }
  // A field keeps its own Home and End.
  const field = page.get('.field');
  field.focus();
  for (const key of ['Home', 'End', ' ']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    await new Promise((done) => setTimeout(done, 20));
    expect(event.defaultPrevented).toBe(false);
  }
  expect(document.activeElement).toBe(field);
});
