// The tests of TagGroup follow the tests of TagGroup in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import TagGroups from './fixtures/taggroups.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function taggroups() {
  const page = await mount(TagGroups, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof taggroups>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

it('is a grid of rows that its label names and its description describes', async () => {
  const page = await taggroups();
  const list = page.get('.list');
  expect(list.getAttribute('role')).toBe('grid');
  expect(list.getAttribute('aria-labelledby')).toBe(page.get('.label').id);
  expect(list.getAttribute('aria-describedby')).toBe(page.get('.description').id);
  expect(list.getAttribute('aria-multiselectable')).toBe('true');
  const tag = page.get('.tag-news');
  expect(tag.getAttribute('role')).toBe('row');
  expect(tag.firstElementChild!.getAttribute('role')).toBe('gridcell');
  expect(tag.getAttribute('aria-selected')).toBe('false');
  expect(tag.hasAttribute('data-allows-removing')).toBe(true);
  expect(page.get('.tag-gaming').getAttribute('aria-disabled')).toBe('true');
  const remove = page.get('.remove-news');
  expect(remove.getAttribute('tabindex')).toBe('-1');
  expect(remove.getAttribute('aria-labelledby')).toBe(`${remove.id} ${tag.id}`);
});

it('takes Tab once, and the arrow keys move past disabled tags', async () => {
  const page = await taggroups();
  page.get('.list').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-news')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-travel')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-shopping')));
  press('Home');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-news')));
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-shopping')));
  await page.waitFor(() => expect(page.get('.list').tabIndex).toBe(-1));
});

it('selects with a press and Space, and not a disabled tag', async () => {
  const page = await taggroups();
  pressWith(page.get('.tag-news'));
  await page.waitFor(() => expect(state(page)[1]).toEqual(['news']));
  page.get('.tag-travel').focus();
  press(' ');
  await page.waitFor(() => expect(state(page)[1]).toEqual(['news', 'travel']));
  expect(page.get('.tag-travel').getAttribute('aria-selected')).toBe('true');
  pressWith(page.get('.tag-gaming'));
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[1]).toEqual(['news', 'travel']);
});

it('removes a tag with its Button, and with Delete, and focus moves to the next', async () => {
  const page = await taggroups();
  pressWith(page.get('.remove-travel'));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['news', 'gaming', 'shopping']));
  page.get('.tag-news').focus();
  press('Delete');
  await page.waitFor(() => expect(state(page)[0]).toEqual(['gaming', 'shopping']));
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-shopping')));
  expect(find('.tag-news')).toBeNull();
});

it('removes the selected tags with Backspace on one of them', async () => {
  const page = await taggroups();
  pressWith(page.get('.tag-news'));
  pressWith(page.get('.tag-shopping'));
  await page.waitFor(() => expect(state(page)[1]).toEqual(['news', 'shopping']));
  page.get('.tag-shopping').focus();
  press('Backspace');
  await page.waitFor(() => expect(state(page)[0]).toEqual(['travel', 'gaming']));
});

it('focuses the list when no tag that can take focus stays', async () => {
  const page = await taggroups();
  // Gaming is disabled, so it cannot take focus once the others go.
  for (const tag of ['news', 'travel', 'shopping']) {
    page.get(`.tag-${tag}`).focus();
    press('Delete');
    await page.waitFor(() => expect(document.querySelector(`.tag-${tag}`)).toBeNull());
  }
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.list')));
});
