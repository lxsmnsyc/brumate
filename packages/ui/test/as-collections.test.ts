// The collection parts with `as`: a component takes the place of their element, gets their
// role, keys and attributes, and gives them its element back through `ref`.
import { afterEach, expect, it, vi } from 'vitest';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

// Each test loads the page afresh, as a visit does. A page that the browser renders again, after
// its code is loaded, takes the component of `as` from the page state, which a component cannot
// render from.
async function collections() {
  vi.resetModules();
  const { mount } = await import('virtual:brumate/testing');
  const { default: AsCollections } = await import('./fixtures/as-collections.brm?brumate-server');
  const page = await mount(AsCollections, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof collections>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

/** The state of the page: fruit, actions, menu checks, rows, nodes, open nodes, section, tags. */
function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

it('renders each part as the component, with its role', async () => {
  const page = await collections();
  const roles: Record<string, string> = {
    '.list': 'listbox',
    '.apple': 'option',
    '.menu': 'menu',
    // The menu selects, so its items are checkboxes.
    '.copy': 'menuitemcheckbox',
    '.grid': 'grid',
    '.row-notes': 'row',
    '.tree': 'treegrid',
    '.node-docs': 'row',
    '.tablist': 'tablist',
    '.tab-intro': 'tab',
    '.tags': 'grid',
    '.tag-news': 'row',
  };
  for (const [selector, role] of Object.entries(roles)) {
    const element = page.get(selector);
    expect([selector, element.getAttribute('role')]).toEqual([selector, role]);
    expect([selector, element.hasAttribute('data-as-target')]).toEqual([selector, true]);
  }
  // The panel of the selected tab is the component too.
  expect(page.get('.panel-intro').getAttribute('role')).toBe('tabpanel');
  expect(page.get('.panel-intro').hasAttribute('data-as-target')).toBe(true);
  // An element name works the same.
  expect(page.get('.ul').tagName).toBe('UL');
  expect(page.get('.ul').getAttribute('role')).toBe('listbox');
  expect(page.get('.one').tagName).toBe('LI');
  expect(page.get('.one').getAttribute('role')).toBe('option');
});

it('gives the element of the component through ref', async () => {
  const page = await collections();
  pressWith(page.get('.read'));
  await page.waitFor(() => expect(page.text('.refs')).toBe('UL LI'));
});

it('moves and selects in a ListBox with the keys', async () => {
  const page = await collections();
  page.get('.apple').focus();
  press('ArrowDown');
  // The next option that is not disabled.
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.banana')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.date')));
  press(' ');
  await page.waitFor(() => expect(state(page)[0]).toEqual(['date']));
  pressWith(page.get('.apple'));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['apple']));
  press('End', page.get('.apple'));
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.date')));
});

it('passes focus from the ListBox to an option', async () => {
  const page = await collections();
  page.get('.list').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.apple')));
});

it('moves in a Menu, and acts and checks with Enter', async () => {
  const page = await collections();
  page.get('.copy').focus();
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.cut')));
  press('Enter');
  await page.waitFor(() => expect(state(page)[1]).toEqual(['cut']));
  await page.waitFor(() => expect(state(page)[2]).toEqual(['cut']));
  expect(page.get('.cut').getAttribute('aria-checked')).toBe('true');
  press('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.copy')));
});

it('moves and selects in a GridList', async () => {
  const page = await collections();
  page.get('.row-notes').focus();
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-photos')));
  press(' ');
  await page.waitFor(() => expect(state(page)[3]).toEqual(['photos']));
  pressWith(page.get('.row-notes'));
  await page.waitFor(() => expect(state(page)[3]).toEqual(['photos', 'notes']));
});

it('moves, selects and closes in a Tree', async () => {
  const page = await collections();
  // The folder starts open, so the browser has not rendered its row.
  expect(page.get('.node-cv').hasAttribute('data-as-target')).toBe(true);
  page.get('.node-docs').focus();
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.node-cv')));
  press(' ');
  await page.waitFor(() => expect(state(page)[4]).toEqual(['cv']));
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.node-docs')));
  press('ArrowLeft');
  await page.waitFor(() => expect(state(page)[5]).toEqual([]));
  await page.waitFor(() => expect(find('.node-cv')).toBeNull());
});

it('moves between tabs and selects them, and links the panel that the server renders', async () => {
  const page = await collections();
  const intro = page.get('.tab-intro');
  expect(intro.getAttribute('aria-selected')).toBe('true');
  expect(page.get('.panel-intro').getAttribute('aria-labelledby')).toBe(intro.id);
  intro.focus();
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tab-usage')));
  await page.waitFor(() => expect(state(page)[6]).toBe('usage'));
  expect(page.get('.tab-usage').getAttribute('aria-selected')).toBe('true');
  expect(intro.getAttribute('aria-selected')).toBe('false');
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(intro));
  await page.waitFor(() => expect(state(page)[6]).toBe('intro'));
});

it('moves between tags, and removes one with Delete', async () => {
  const page = await collections();
  page.get('.tags').focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-news')));
  press('ArrowRight');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.tag-travel')));
  press('Delete');
  await page.waitFor(() => expect(state(page)[7]).toEqual(['news', 'gaming']));
});
