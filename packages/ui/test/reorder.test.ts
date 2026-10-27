// The tests of drags in a GridList.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import DragOut from './fixtures/drag-out.brm?brumate-server';
import Reorder from './fixtures/reorder.brm?brumate-server';
import { dragTypes, dropItems } from '../src/drop.ts';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function reorder() {
  const page = await mount(Reorder, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof reorder>>;

function files(page: Page) {
  return JSON.parse(page.text('.state')) as string[];
}

/** A DataTransfer that keeps what a drag puts in it. */
function transfer() {
  const data = new Map<string, string>();
  return {
    data,
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    get types() {
      return [...data.keys()];
    },
    files: [] as File[],
    effectAllowed: 'all',
    dropEffect: 'none',
  };
}

function fire(target: Element, type: string, dataTransfer: unknown, clientY = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientY: { value: clientY },
  });
  target.dispatchEvent(event);
  return event;
}

it('moves a row with the keys from its drag button', async () => {
  const page = await reorder();
  expect(page.get('.row-a').getAttribute('draggable')).toBe('true');
  expect(page.get('.drag-a').getAttribute('aria-label')).toBe('Drag File a');
  pressWith(page.get('.drag-a'));
  // The drag starts at the place after the row, and focuses the row there.
  await page.waitFor(() =>
    expect(page.get('.row-b').getAttribute('data-drop-target')).toBe('before'),
  );
  expect(page.get('.row-a').hasAttribute('data-dragging')).toBe(true);
  expect(document.activeElement).toBe(page.get('.row-b'));
  press('ArrowDown');
  await page.waitFor(() =>
    expect(page.get('.row-c').getAttribute('data-drop-target')).toBe('before'),
  );
  press('ArrowDown');
  await page.waitFor(() =>
    expect(page.get('.row-d').getAttribute('data-drop-target')).toBe('before'),
  );
  press('ArrowDown');
  await page.waitFor(() =>
    expect(page.get('.row-d').getAttribute('data-drop-target')).toBe('after'),
  );
  press('Enter');
  await page.waitFor(() => expect(files(page)).toEqual(['b', 'c', 'd', 'a']));
  expect(page.get('.row-a').hasAttribute('data-dragging')).toBe(false);
});

it('cancels a drag from the keys with Escape', async () => {
  const page = await reorder();
  pressWith(page.get('.drag-b'));
  await page.waitFor(() => expect(page.get('.row-b').hasAttribute('data-dragging')).toBe(true));
  press('Escape');
  await page.waitFor(() => expect(page.get('.row-b').hasAttribute('data-dragging')).toBe(false));
  expect(files(page)).toEqual(['a', 'b', 'c', 'd']);
  expect(document.activeElement).toBe(page.get('.row-b'));
});

it('moves the selected rows with a drag of the pointer, and gives their data', async () => {
  const page = await reorder();
  pressWith(page.get('.row-a'));
  pressWith(page.get('.row-b'));
  await page.waitFor(() => expect(page.get('.row-b').getAttribute('aria-selected')).toBe('true'));
  // The listeners start with the page.
  await new Promise((done) => setTimeout(done, 50));
  const data = transfer();
  fire(page.get('.row-a'), 'dragstart', data);
  expect(data.getData('text/plain')).toBe('file a\nfile b');
  page.get('.row-d').getBoundingClientRect = () => ({ top: 100, height: 20 }) as DOMRect;
  const over = fire(page.get('.row-d'), 'dragover', data, 115);
  expect(over.defaultPrevented).toBe(true);
  await page.waitFor(() =>
    expect(page.get('.row-d').getAttribute('data-drop-target')).toBe('after'),
  );
  fire(page.get('.row-d'), 'drop', data, 115);
  fire(page.get('.row-a'), 'dragend', data);
  await page.waitFor(() => expect(files(page)).toEqual(['c', 'd', 'a', 'b']));
});

/** Selects the rows with presses, and waits until they show it. */
async function select(page: Pick<Page, 'get' | 'waitFor'>, ...keys: string[]) {
  for (const key of keys) {
    pressWith(page.get(`.row-${key}`));
    await page.waitFor(() =>
      expect(page.get(`.row-${key}`).getAttribute('aria-selected')).toBe('true'),
    );
  }
}

function calls(page: Page) {
  return Number(page.text('.calls'));
}

/** Starts a drag of the pointer from a row and waits for the listeners of the page. */
async function dragFrom(page: Page, key: string) {
  await new Promise((done) => setTimeout(done, 50));
  const data = transfer();
  fire(page.get(`.row-${key}`), 'dragstart', data);
  await page.waitFor(() =>
    expect(page.get(`.row-${key}`).hasAttribute('data-dragging')).toBe(true),
  );
  return data;
}

function layout(row: Element) {
  row.getBoundingClientRect = () => ({ top: 100, height: 20 }) as DOMRect;
}

it('does not offer a dragged row as a drop target, and drops nothing on it', async () => {
  const page = await reorder();
  await select(page, 'a', 'b');
  const data = await dragFrom(page, 'a');
  layout(page.get('.row-b'));
  const over = fire(page.get('.row-b'), 'dragover', data, 105);
  expect(over.defaultPrevented).toBe(false);
  expect(page.get('.row-b').hasAttribute('data-drop-target')).toBe(false);
  fire(page.get('.row-b'), 'drop', data, 105);
  await page.waitFor(() => expect(page.get('.row-a').hasAttribute('data-dragging')).toBe(false));
  expect(calls(page)).toBe(0);
  expect(files(page)).toEqual(['a', 'b', 'c', 'd']);
});

it('does not reorder on a drop that changes nothing', async () => {
  const page = await reorder();
  const data = await dragFrom(page, 'b');
  // After a, and before c, are where b is.
  layout(page.get('.row-c'));
  fire(page.get('.row-c'), 'dragover', data, 105);
  await page.waitFor(() =>
    expect(page.get('.row-c').getAttribute('data-drop-target')).toBe('before'),
  );
  fire(page.get('.row-c'), 'drop', data, 105);
  await page.waitFor(() => expect(page.get('.row-b').hasAttribute('data-dragging')).toBe(false));
  expect(calls(page)).toBe(0);
});

it('takes no drop in the gap of the list, and clears the target there', async () => {
  const page = await reorder();
  const data = await dragFrom(page, 'a');
  layout(page.get('.row-d'));
  fire(page.get('.row-d'), 'dragover', data, 115);
  await page.waitFor(() =>
    expect(page.get('.row-d').getAttribute('data-drop-target')).toBe('after'),
  );
  const over = fire(page.get('.list'), 'dragover', data, 300);
  expect(over.defaultPrevented).toBe(false);
  await page.waitFor(() => expect(page.get('.row-d').hasAttribute('data-drop-target')).toBe(false));
  const dropped = fire(page.get('.list'), 'drop', data, 300);
  expect(dropped.defaultPrevented).toBe(false);
  await page.waitFor(() => expect(page.get('.row-a').hasAttribute('data-dragging')).toBe(false));
  expect(calls(page)).toBe(0);
});

it('leaves a drag that it did not start alone, such as a file', async () => {
  const page = await reorder();
  await new Promise((done) => setTimeout(done, 50));
  const file = { ...transfer(), types: ['Files'] };
  expect(fire(page.get('.row-a'), 'dragover', file).defaultPrevented).toBe(false);
  expect(fire(page.get('.list'), 'dragover', file).defaultPrevented).toBe(false);
});

it('does not make a list that only drags out a place for drops', async () => {
  const page = await mount(DragOut, {});
  unmount = page.unmount;
  await new Promise((done) => setTimeout(done, 50));
  const file = { ...transfer(), types: ['Files'] };
  expect(fire(page.get('.out'), 'dragover', file).defaultPrevented).toBe(false);
  expect(fire(page.get('.row-a'), 'dragover', file).defaultPrevented).toBe(false);
});

it('offers a place after the last row that stays, from the keys', async () => {
  const page = await reorder();
  await select(page, 'b', 'd');
  pressWith(page.get('.drag-b'));
  // The first place after the dragged row.
  await page.waitFor(() =>
    expect(page.get('.row-c').getAttribute('data-drop-target')).toBe('before'),
  );
  press('ArrowDown');
  await page.waitFor(() =>
    expect(page.get('.row-c').getAttribute('data-drop-target')).toBe('after'),
  );
  press('Enter');
  await page.waitFor(() => expect(files(page)).toEqual(['a', 'c', 'b', 'd']));
});

it('cancels a drag from the keys when focus leaves the list, and prevents its keys', async () => {
  const page = await reorder();
  pressWith(page.get('.drag-a'));
  await page.waitFor(() => expect(page.get('.row-a').hasAttribute('data-dragging')).toBe(true));
  const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
  document.activeElement!.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  (document.activeElement as HTMLElement).blur();
  await page.waitFor(() => expect(page.get('.row-a').hasAttribute('data-dragging')).toBe(false));
  expect(files(page)).toEqual(['a', 'b', 'c', 'd']);
});

it('ends a drag of the pointer when its dragend does not reach the list', async () => {
  const page = await reorder();
  await dragFrom(page, 'a');
  document.dispatchEvent(new Event('dragend', { bubbles: true }));
  await page.waitFor(() => expect(page.get('.row-a').hasAttribute('data-dragging')).toBe(false));
});

it('gives one item for each dragged row to a DropZone, in list order', async () => {
  const page = await mount(DragOut, {});
  unmount = page.unmount;
  await select(page, 'c', 'a');
  await new Promise((done) => setTimeout(done, 50));
  const data = transfer();
  fire(page.get('.row-c'), 'dragstart', data);
  fire(page.get('.zone'), 'dragenter', data);
  fire(page.get('.zone'), 'drop', data);
  await page.waitFor(() =>
    expect(JSON.parse(page.text('.state'))[0]).toEqual(['file a', 'file c']),
  );
  // The type that marks the rows is not one of the types of the drag.
  expect(JSON.parse(page.text('.state'))[1]).toEqual(['text/plain']);
  expect([...dragTypes(data as unknown as DataTransfer)]).toEqual(['text/plain']);
  expect(dropItems(data as unknown as DataTransfer)).toHaveLength(2);
});

it('does not enable the drag button of a list that only drags out', async () => {
  const page = await mount(DragOut, {});
  unmount = page.unmount;
  expect(page.get('.row-a').getAttribute('draggable')).toBe('true');
  expect(page.get('.drag-a').hasAttribute('disabled')).toBe(true);
});
