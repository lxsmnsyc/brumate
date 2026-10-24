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
