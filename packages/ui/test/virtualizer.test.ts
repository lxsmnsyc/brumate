// The tests of Virtualizer follow the tests of Virtualizer in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Virtualized from './fixtures/virtualized.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

it('renders the first rows of a Tree in it, and spacers for the height of the rest', async () => {
  const page = await mount(Virtualized, {});
  unmount = page.unmount;
  expect(page.get('.box').hasAttribute('data-virtualizer')).toBe(true);
  const tree = page.get('.tree');
  const after = tree.querySelector<HTMLElement>('[data-window=after]')!;
  expect(after.getAttribute('aria-hidden')).toBe('true');
  // The rows that render keep their place in the tree.
  expect(page.get('.row-f0').getAttribute('aria-posinset')).toBe('1');
  expect(page.get('.row-f0').getAttribute('aria-setsize')).toBe('200');
  // The window renders fewer rows than the 200 of the list.
  await page.waitFor(() => expect(tree.querySelectorAll('[role=row]').length).toBeLessThan(30));
  expect(parseFloat(after.style.height)).toBeGreaterThan(24 * 150);
  page.get('.row-f0').focus();
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-f1')));
});
