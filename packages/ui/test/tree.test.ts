// The tests of Tree follow the tests of Tree in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Trees from './fixtures/trees.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function trees() {
  const page = await mount(Trees, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof trees>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function keys(page: Page, tree: string) {
  return [...page.get(tree).querySelectorAll('[role=row]')].map((row) =>
    JSON.parse(row.getAttribute('data-key')!),
  );
}

it('is a treegrid of flat rows, with their level, place and state from the server', async () => {
  const page = await trees();
  const tree = page.get('.tree');
  expect(tree.getAttribute('role')).toBe('treegrid');
  // The children of an open item follow it, and those of a closed item do not render.
  expect(keys(page, '.tree')).toEqual(['docs', 'cv', 'work', 'photos', 'notes']);
  const docs = page.get('.row-docs');
  expect(docs.getAttribute('aria-level')).toBe('1');
  expect(docs.getAttribute('aria-posinset')).toBe('1');
  expect(docs.getAttribute('aria-setsize')).toBe('3');
  expect(docs.getAttribute('aria-expanded')).toBe('true');
  expect(docs.hasAttribute('data-expanded')).toBe(true);
  expect(docs.getAttribute('data-level')).toBe('1');
  const work = page.get('.row-work');
  expect(work.getAttribute('aria-level')).toBe('2');
  expect(work.getAttribute('aria-posinset')).toBe('2');
  expect(work.getAttribute('aria-setsize')).toBe('2');
  expect(work.getAttribute('aria-expanded')).toBe('false');
  // An empty folder is a parent, and a file is not.
  expect(page.get('.row-photos').getAttribute('aria-expanded')).toBe('false');
  expect(page.get('.row-photos').hasAttribute('data-has-child-items')).toBe(true);
  expect(page.get('.row-notes').hasAttribute('aria-expanded')).toBe(false);
  expect(page.get('.row-notes').getAttribute('aria-disabled')).toBe('true');
  expect(docs.firstElementChild!.getAttribute('role')).toBe('gridcell');
  // The chevron is not a tab stop, and names what it does to its row.
  const chevron = page.get('.chevron-docs');
  expect(chevron.getAttribute('tabindex')).toBe('-1');
  expect(chevron.getAttribute('aria-label')).toBe('Collapse');
  expect(chevron.getAttribute('aria-labelledby')).toContain(docs.id);
  expect(page.get('.chevron-work').getAttribute('aria-label')).toBe('Expand');
});

it('opens with Right, closes with Left, and moves to the parent with Left', async () => {
  const page = await trees();
  page.get('.tree').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-docs')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-cv')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-work')));
  press('ArrowRight');
  await page.waitFor(() => expect(keys(page, '.tree')).toContain('plan'));
  expect(state(page)[1]).toEqual(['docs', 'work']);
  expect(page.get('.row-plan').getAttribute('aria-level')).toBe('3');
  // On an open row, Right moves through its controls.
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.check-work input')));
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-work')));
  press('ArrowLeft');
  await page.waitFor(() => expect(keys(page, '.tree')).not.toContain('plan'));
  expect(state(page)[1]).toEqual(['docs']);
  // On a closed row, Left moves to the row that holds it.
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-docs')));
  press('ArrowLeft');
  await page.waitFor(() => expect(keys(page, '.tree')).toEqual(['docs', 'photos', 'notes']));
});

it('opens and closes with the chevron, which keeps focus on the row', async () => {
  const page = await trees();
  pressWith(page.get('.chevron-docs'));
  await page.waitFor(() => expect(keys(page, '.tree')).toEqual(['docs', 'photos', 'notes']));
  expect(state(page)[0]).toEqual([]);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-docs')));
  // The label follows the state, so the second press comes after the first is done.
  await page.waitFor(() =>
    expect(page.get('.chevron-docs').getAttribute('aria-label')).toBe('Expand'),
  );
  pressWith(page.get('.chevron-docs'));
  await page.waitFor(() => expect(keys(page, '.tree')).toContain('cv'));
  expect(page.get('.chevron-docs').getAttribute('aria-label')).toBe('Collapse');
});

it('selects as a GridList does, and a press of a Button in a row is its own', async () => {
  const page = await trees();
  page.get('.tree').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-docs')));
  press(' ');
  await page.waitFor(() => expect(state(page)[0]).toEqual(['docs']));
  pressWith(page.get('.edit-cv'));
  await page.waitFor(() => expect(state(page)[3]).toBe(1));
  page.get('.check-cv input').click();
  await page.waitFor(() => expect(state(page)[0]).toEqual(['docs', 'cv']));
});

it('opens and closes on a press and Enter when nothing is selectable, and acts with onAction', async () => {
  const page = await trees();
  expect(keys(page, '.plain')).toEqual(['docs', 'photos', 'notes']);
  pressWith(page.get('.plain .leaf-docs'));
  await page.waitFor(() =>
    expect(keys(page, '.plain')).toEqual(['docs', 'cv', 'work', 'photos', 'notes']),
  );
  page.get('.plain .leaf-docs').focus();
  press('Enter');
  await page.waitFor(() => expect(keys(page, '.plain')).toEqual(['docs', 'photos', 'notes']));
  pressWith(page.get('.acting .leaf-photos'));
  await page.waitFor(() => expect(state(page)[2]).toEqual(['photos']));
  expect(keys(page, '.acting')).toEqual(['docs', 'photos', 'notes']);
});
