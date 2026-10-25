// The tests of drags in a GridList follow the tests of useDragAndDrop in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Reorder from './fixtures/reorder.brm?brumate-server';
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
