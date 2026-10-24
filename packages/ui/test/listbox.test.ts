// The tests of ListBox follow the tests of ListBox in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ListBoxes from './fixtures/listboxes.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function listboxes() {
  const page = await mount(ListBoxes, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof listboxes>>;

/** The state of the page: the selection of each list, and the actions. */
function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[][];
}

it('renders a listbox of options, with their selection, sections and names', async () => {
  const page = await listboxes();
  const single = page.get('.single');
  expect(single.getAttribute('role')).toBe('listbox');
  expect(single.getAttribute('tabindex')).toBe('0');
  expect(single.hasAttribute('aria-multiselectable')).toBe(false);
  expect(page.get('.banana').getAttribute('role')).toBe('option');
  expect(page.get('.banana').getAttribute('aria-selected')).toBe('true');
  expect(page.get('.banana').hasAttribute('data-selected')).toBe(true);
  expect(page.get('.apple').getAttribute('aria-selected')).toBe('false');
  expect(page.get('.cherry').getAttribute('aria-disabled')).toBe('true');
  expect(page.get('.multi').getAttribute('aria-multiselectable')).toBe('true');
  // A section is a group that its header names, or its aria-label.
  expect(page.get('.sauces').getAttribute('role')).toBe('group');
  expect(page.get('.sauces').getAttribute('aria-labelledby')).toBe(page.get('.sauces-header').id);
  expect(page.get('.cheeses').getAttribute('aria-label')).toBe('Cheese');
  expect(page.get('.cheeses').hasAttribute('aria-labelledby')).toBe(false);
  // The label and the description of an item name and describe it.
  expect(page.get('.date').getAttribute('aria-labelledby')).toBe(page.get('.date-label').id);
  expect(page.get('.date').getAttribute('aria-describedby')).toBe(page.get('.date-description').id);
  // An option of a list that selects nothing has no aria-selected.
  expect(page.get('.copy').hasAttribute('aria-selected')).toBe(false);
});

it('passes its focus on to the selected item, and Tab stops at it once', async () => {
  const page = await listboxes();
  const single = page.get('.single');
  single.focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.banana')));
  await page.waitFor(() => expect(single.tabIndex).toBe(-1));
  // Focus leaves, and the list takes Tab again.
  page.get('.before').focus();
  await page.waitFor(() => expect(single.tabIndex).toBe(0));
  // It comes back to the item that had focus last.
  page.get('.apple').focus();
  page.get('.before').focus();
  single.focus();
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.apple')));
});

it('moves focus with the arrow keys, Home and End, past disabled items', async () => {
  const page = await listboxes();
  page.get('.banana').focus();
  const keyDown = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    return event;
  };
  // The keys are prevented before the code loads, so the page does not scroll.
  expect(keyDown('ArrowDown').defaultPrevented).toBe(true);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.date')));
  keyDown('ArrowDown');
  // No wrap: the last item keeps focus.
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(document.activeElement).toBe(page.get('.date'));
  keyDown('Home');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.apple')));
  keyDown('End');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.date')));
  keyDown('ArrowUp');
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.banana')));
  // Moving focus does not select, in the toggle behavior.
  expect(state(page)[0]).toEqual(['banana']);
});

it('selects one item with Space and a press, and a press again clears it', async () => {
  const page = await listboxes();
  page.get('.apple').focus();
  press(' ', page.get('.apple'));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['apple']));
  expect(page.get('.banana').getAttribute('aria-selected')).toBe('false');
  pressWith(page.get('.date'));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['date']));
  pressWith(page.get('.date'));
  await page.waitFor(() => expect(state(page)[0]).toEqual([]));
  // A disabled item takes no press.
  pressWith(page.get('.cherry'));
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(state(page)[0]).toEqual([]);
});

it('adds and removes items of a multiple selection, extends it with Shift, and Ctrl+A and Escape', async () => {
  const page = await listboxes();
  pressWith(page.get('.feta'));
  await page.waitFor(() => expect(state(page)[1]).toEqual(['feta']));
  pressWith(page.get('.feta'));
  await page.waitFor(() => expect(state(page)[1]).toEqual([]));
  // Space selects the item with focus, which becomes the anchor of a range.
  page.get('.tomato').focus();
  press(' ', page.get('.tomato'));
  await page.waitFor(() => expect(state(page)[1]).toEqual(['tomato']));
  // Shift and the arrow keys extend it from the anchor, across sections.
  press('ArrowDown', page.get('.tomato'), { shiftKey: true });
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.pesto')));
  press('ArrowDown', page.get('.pesto'), { shiftKey: true });
  await page.waitFor(() => expect(state(page)[1]).toEqual(['tomato', 'pesto', 'mozzarella']));
  // Going back shrinks the range.
  press('ArrowUp', page.get('.mozzarella'), { shiftKey: true });
  await page.waitFor(() => expect(state(page)[1]).toEqual(['tomato', 'pesto']));
  press('a', document.activeElement, { ctrlKey: true });
  await page.waitFor(() => expect(state(page)[1]).toHaveLength(4));
  press('Escape', document.activeElement);
  await page.waitFor(() => expect(state(page)[1]).toEqual([]));
});

it('selects the item that has focus in the replace behavior, and Shift selects a range', async () => {
  const page = await listboxes();
  pressWith(page.get('.file-a'));
  await page.waitFor(() => expect(state(page)[2]).toEqual(['a']));
  pressWith(page.get('.file-c'), { shiftKey: true });
  await page.waitFor(() => expect(state(page)[2]).toEqual(['a', 'b', 'c']));
  // A press without a key replaces the selection.
  pressWith(page.get('.file-b'));
  await page.waitFor(() => expect(state(page)[2]).toEqual(['b']));
  // Ctrl adds to it.
  pressWith(page.get('.file-d'), { ctrlKey: true });
  await page.waitFor(() => expect(state(page)[2]).toEqual(['b', 'd']));
  // The arrow keys move the selection with focus, and Ctrl moves focus alone.
  page.get('.file-b').focus();
  press('ArrowDown', page.get('.file-b'));
  await page.waitFor(() => expect(state(page)[2]).toEqual(['c']));
  press('ArrowDown', page.get('.file-c'), { ctrlKey: true });
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.file-d')));
  expect(state(page)[2]).toEqual(['c']);
});

it('moves focus to the item that starts with what is typed', async () => {
  const page = await listboxes();
  page.get('.apple').focus();
  press('d', page.get('.apple'));
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.date')));
  // A disabled item is not reached.
  press('c', page.get('.date'));
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(document.activeElement).toBe(page.get('.date'));
});

it('acts on an item with Enter and a press when it selects nothing', async () => {
  const page = await listboxes();
  page.get('.copy').focus();
  press('Enter', page.get('.copy'));
  await page.waitFor(() => expect(state(page)[3]).toEqual(['copy']));
  pressWith(page.get('.paste'));
  await page.waitFor(() => expect(state(page)[3]).toEqual(['copy', 'paste']));
});

it('keeps keys that are numbers', async () => {
  const page = await listboxes();
  pressWith(page.get('.size-2'));
  await page.waitFor(() => expect(state(page)[4]).toEqual([2]));
  expect(page.get('.size-2').getAttribute('aria-selected')).toBe('true');
});

it('wraps focus with shouldFocusWrap, and pages with PageDown and PageUp', async () => {
  const { moveFrom } = await import('../src/collection.ts');
  const root = document.createElement('div');
  const items = ['a', 'b', 'c'].map((name) => {
    const item = document.createElement('div');
    item.textContent = name;
    root.append(item);
    return item;
  });
  expect(moveFrom(root, items, items[2], 'next', true)).toBe(items[0]);
  expect(moveFrom(root, items, items[0], 'previous', true)).toBe(items[2]);
  expect(moveFrom(root, items, items[2], 'next', false)).toBe(items[2]);
  // happy-dom lays nothing out, so a page reaches the last item in its direction.
  expect(moveFrom(root, items, items[0], 'pageDown', false)).toBe(items[2]);
  expect(moveFrom(root, items, items[2], 'pageUp', false)).toBe(items[0]);
});
