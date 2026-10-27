// The tests of NavigationTree follow the tests of NavigationTree in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Navigation from './fixtures/nav-tree-page.brm?brumate-server';
import NavigationRef from './fixtures/nav-tree-ref-page.brm?brumate-server';
import { press, pressWith } from './interact.ts';
import { ancestorsOf } from '../src/navigation-tree.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function navigation() {
  const page = await mount(Navigation, {});
  unmount = page.unmount;
  return page;
}

it('finds the items that hold the item of a route', () => {
  const items = [
    { id: 'a', href: '/a' },
    { id: 'b', children: [{ id: 'c', children: [{ id: 'd', href: '/d' }] }] },
  ];
  expect(ancestorsOf(items, '/d')).toEqual(['b', 'c']);
  expect(ancestorsOf(items, '/a')).toEqual([]);
  expect(ancestorsOf(items, null)).toEqual([]);
});

it('moves between the links with Up and Down, and opens and closes with Right and Left', async () => {
  const page = await navigation();
  page.get('.link-start').focus();
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.item-guides')));
  // On a row with children, Right opens it, from its link or the row.
  press('ArrowRight');
  await page.waitFor(() => expect(page.text('.state')).toBe('["guides"]'));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.link-forms')));
  // Left on a closed row goes to the row that holds it.
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.item-guides')));
  press('ArrowLeft');
  await page.waitFor(() => expect(page.text('.state')).toBe('[]'));
  // Letters move to the row whose text starts with them.
  page.get('.link-start').focus();
  press('a');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.link-api')));
});

it('links its rows, and marks the current page and the closed items that hold it', async () => {
  const page = await navigation();
  const tree = page.get('.nav');
  expect(tree.getAttribute('role')).toBe('treegrid');
  // The links are the stops of Tab, not the tree.
  expect(tree.hasAttribute('tabindex')).toBe(false);
  expect(page.get('.link-start').tagName).toBe('A');
  expect(page.get('.link-start').getAttribute('href')).toBe('#start');
  expect(page.get('.item-start').hasAttribute('data-href')).toBe(true);
  // An item without an href has no link.
  expect(page.get('.link-guides').tagName).toBe('SPAN');
  expect(page.get('.item-guides').hasAttribute('data-current-ancestor')).toBe(true);
  pressWith(page.get('.chevron-guides'));
  await page.waitFor(() => expect(page.get('.item-data')).toBeTruthy());
  expect(page.get('.item-guides').hasAttribute('data-current-ancestor')).toBe(false);
  expect(page.get('.item-data').hasAttribute('data-current-ancestor')).toBe(true);
  pressWith(page.get('.chevron-data'));
  await page.waitFor(() => expect(page.get('.link-tables')).toBeTruthy());
  expect(page.get('.link-tables').getAttribute('aria-current')).toBe('page');
  expect(page.get('.item-tables').hasAttribute('data-current')).toBe(true);
  expect(page.get('.link-forms').hasAttribute('aria-current')).toBe(false);
});

it('renders the link of a disabled item as a span that no one can focus or follow', async () => {
  const page = await navigation();
  // Disabled by isDisabled on the item, and by disabledKeys on the tree.
  for (const name of ['old', 'gone']) {
    const link = page.get(`.link-${name}`);
    expect(link.tagName).toBe('SPAN');
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.hasAttribute('tabindex')).toBe(false);
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.hasAttribute('data-disabled')).toBe(true);
    expect(page.get(`.item-${name}`).getAttribute('aria-disabled')).toBe('true');
  }
  expect(page.get('.link-api').tagName).toBe('A');
});

it('gives the ref of an item to its row', async () => {
  const page = await mount(NavigationRef, {});
  unmount = page.unmount;
  page.get('.read').click();
  await page.waitFor(() => expect(page.text('.seen')).toBe('row'));
});
