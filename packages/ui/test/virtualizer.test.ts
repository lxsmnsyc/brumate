// The tests of Virtualizer follow the tests of Virtualizer in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Virtualized from './fixtures/virtualized.brm?brumate-server';
import VirtualizedGridList from './fixtures/virtualized-grid-list.brm?brumate-server';
import VirtualizedListBox from './fixtures/virtualized-list-box.brm?brumate-server';
import VirtualizedTable from './fixtures/virtualized-table.brm?brumate-server';
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
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-c0')));
});

// happy-dom has no layout, so the boxes of the scroller and the spacers follow the scroll.
const ROW = 24;
const HEIGHT = 120;
function layout() {
  const original = HTMLElement.prototype.getBoundingClientRect;
  const sizes = ['clientHeight', 'scrollHeight'].map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  );
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const box = this.closest('[data-virtualizer]') as HTMLElement | null;
    const scrolled = box?.scrollTop ?? 0;
    let top = 0;
    let height = 0;
    if (this.hasAttribute('data-virtualizer')) {
      height = HEIGHT;
    } else if (this.hasAttribute('data-collection')) {
      top = -scrolled;
    } else if (this.dataset.window === 'before') {
      top = -scrolled;
      height = parseFloat(this.style.height);
    } else if (this.dataset.window === 'after') {
      const before = this.parentElement!.querySelector<HTMLElement>('[data-window=before]')!;
      const rows = this.parentElement!.querySelectorAll(':scope > [data-key]').length;
      top = -scrolled + parseFloat(before.style.height) + rows * ROW;
      height = parseFloat(this.style.height);
    }
    return new DOMRect(0, top, 100, height);
  };
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-virtualizer') ? HEIGHT : 0;
    },
  });
  // The box holds more than it shows, so the window takes it as its scroller.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute('data-virtualizer') ? 300 * ROW : 0;
    },
  });
  return () => {
    HTMLElement.prototype.getBoundingClientRect = original;
    for (const [name, descriptor] of sizes) {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, name, descriptor);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
      }
    }
  };
}

async function windowed(fixture: typeof Virtualized = Virtualized) {
  const restore = layout();
  const page = await mount(fixture, {});
  unmount = () => {
    page.unmount();
    restore();
  };
  return page;
}

it('counts and numbers its rows, since not all of them are in the page', async () => {
  const page = await windowed();
  // The 200 items and the 100 children of the first.
  expect(page.get('.tree').getAttribute('aria-rowcount')).toBe('300');
  expect(page.get('.row-f0').getAttribute('aria-rowindex')).toBe('1');
  expect(page.get('.row-c0').getAttribute('aria-rowindex')).toBe('2');
});

it('goes to the last row with End, and back to the first with Home', async () => {
  const page = await windowed();
  page.get('.row-f0').focus();
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-f199')));
  expect(page.get('.tree').querySelectorAll('[role=row]').length).toBeLessThan(30);
  press('Home');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-f0')));
});

it('moves a page of rows with PageDown and PageUp', async () => {
  const page = await windowed();
  page.get('.row-f0').focus();
  press('PageDown');
  // A page of the box is 5 rows.
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-c4')));
  press('PageUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-f0')));
});

it('selects every row with Ctrl+A, and a range with Shift+End', async () => {
  const page = await windowed();
  page.get('.row-f0').focus();
  press('a', document.activeElement, { ctrlKey: true });
  await page.waitFor(() => expect(JSON.parse(page.text('.state')).length).toBe(300));
  press('Escape');
  await page.waitFor(() => expect(page.text('.state')).toBe('[]'));
  press('End', document.activeElement, { shiftKey: true });
  await page.waitFor(() => expect(JSON.parse(page.text('.state')).length).toBe(300));
});

it('searches all rows with typeahead', async () => {
  const page = await windowed();
  page.get('.row-f0').focus();
  press('z');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-f120')));
});

it('moves to a parent that is not rendered with Left', async () => {
  const page = await windowed();
  page.get('.row-f0').focus();
  for (const letter of 'child 99') {
    press(letter);
  }
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-c99')));
  expect(page.get('.tree').querySelector('.row-f0')).toBe(null);
  press('ArrowLeft');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-f0')));
});

// The other collections take their items as data, so they move, select and search all their rows
// while only some are in the page.
const collections = [
  ['GridList', VirtualizedGridList, 'row'],
  ['ListBox', VirtualizedListBox, 'option'],
  ['Table', VirtualizedTable, 'row'],
] as const;

for (const [name, fixture, role] of collections) {
  const rendered = (page: { get: (selector: string) => HTMLElement }) =>
    page.get('.list').querySelectorAll(`[role=${role}][data-key]`).length;

  it(`renders the first rows of a ${name}, and spacers for the height of the rest`, async () => {
    const page = await windowed(fixture);
    const after = page.get('.list').querySelector<HTMLElement>('[data-window=after]')!;
    expect(after.getAttribute('aria-hidden')).toBe('true');
    await page.waitFor(() => expect(rendered(page)).toBeLessThan(30));
    expect(parseFloat(after.style.height)).toBeGreaterThan(24 * 250);
    page.get('.row-r0').focus();
    press('ArrowDown');
    await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-r1')));
  });

  it(`goes to the last row of a ${name} with End, and back to the first with Home`, async () => {
    const page = await windowed(fixture);
    page.get('.row-r0').focus();
    press('End');
    await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-r299')));
    expect(rendered(page)).toBeLessThan(30);
    press('Home');
    await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-r0')));
  });

  it(`moves a page of rows of a ${name} with PageDown and PageUp`, async () => {
    const page = await windowed(fixture);
    page.get('.row-r0').focus();
    press('PageDown');
    // A page of the box is 5 rows.
    await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-r5')));
    press('PageUp');
    await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-r0')));
  });

  it(`selects every row of a ${name} with Ctrl+A, and a range with Shift+End`, async () => {
    const page = await windowed(fixture);
    page.get('.row-r0').focus();
    press('a', document.activeElement, { ctrlKey: true });
    await page.waitFor(() => expect(JSON.parse(page.text('.state')).length).toBe(300));
    press('Escape');
    await page.waitFor(() => expect(page.text('.state')).toBe('[]'));
    press('End', document.activeElement, { shiftKey: true });
    await page.waitFor(() => expect(JSON.parse(page.text('.state')).length).toBe(300));
  });

  it(`searches all rows of a ${name} with typeahead`, async () => {
    const page = await windowed(fixture);
    page.get('.row-r0').focus();
    press('z');
    await page.waitFor(() => expect(document.activeElement).toBe(page.get('.row-r120')));
  });
}

it('selects every row of a Table from the box in its header, not only those in the page', async () => {
  const page = await windowed(VirtualizedTable);
  page.get('.select-all input').click();
  await page.waitFor(() => expect(JSON.parse(page.text('.state')).length).toBe(300));
});
