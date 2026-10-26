// The tests of DropZone follow the tests of DropZone in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import DropZones from './fixtures/drop-zones.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function zones() {
  const page = await mount(DropZones, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof zones>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as [string[], number, string[]];
}

/** A DataTransfer with text, as a drag or a paste carries it. */
function data(text: Record<string, string>, files: File[] = [], effectAllowed = 'all') {
  return {
    types: [...Object.keys(text), ...(files.length ? ['Files'] : [])],
    getData: (type: string) => text[type] ?? '',
    files,
    items: [
      ...Object.keys(text).map((type) => ({ kind: 'string', type })),
      ...files.map((file) => ({ kind: 'file', type: file.type })),
    ],
    dropEffect: 'none',
    effectAllowed,
  };
}

function fire(target: Element, type: string, field: string, value: unknown) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, field, { value });
  target.dispatchEvent(event);
}

it('names its hidden button by its label, and a click on it focuses the button', async () => {
  const page = await zones();
  const button = page.get('.zone button');
  expect(button.getAttribute('aria-labelledby')).toContain(page.get('.label').id);
  page.get('.zone').click();
  await page.waitFor(() => expect(document.activeElement).toBe(button));
});

it('takes a drop of text, and shows a drag over it', async () => {
  const page = await zones();
  const zone = page.get('.zone');
  // The listeners start with the page.
  await new Promise((done) => setTimeout(done, 50));
  fire(zone, 'dragenter', 'dataTransfer', data({ 'text/plain': 'hello' }));
  await page.waitFor(() => expect(zone.hasAttribute('data-drop-target')).toBe(true));
  expect(state(page)[1]).toBe(1);
  fire(zone, 'drop', 'dataTransfer', data({ 'text/plain': 'hello' }));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['hello']));
  expect(zone.hasAttribute('data-drop-target')).toBe(false);
});

it('refuses a drop that its drop operation cancels, and takes a paste on its button', async () => {
  const page = await zones();
  const zone = page.get('.zone');
  await new Promise((done) => setTimeout(done, 50));
  const image = new File(['x'], 'cat.png', { type: 'image/png' });
  fire(zone, 'dragenter', 'dataTransfer', data({}, [image]));
  await new Promise((done) => setTimeout(done, 50));
  expect(zone.hasAttribute('data-drop-target')).toBe(false);
  fire(zone, 'drop', 'dataTransfer', data({}, [image]));
  fire(page.get('.zone button'), 'paste', 'clipboardData', data({ 'text/plain': 'pasted' }));
  await page.waitFor(() => expect(state(page)[0]).toEqual(['pasted']));
});

it('gives getDropOperation the operations that the source allows, and refuses others', async () => {
  const page = await zones();
  const zone = page.get('.zone');
  await new Promise((done) => setTimeout(done, 50));
  const link = data({ 'text/plain': 'hello' }, [], 'link');
  fire(zone, 'dragenter', 'dataTransfer', link);
  await page.waitFor(() => expect(state(page)[2]).toEqual(['link']));
  // The fixture's operation is a copy, which a drag that only links does not allow.
  expect(zone.hasAttribute('data-drop-target')).toBe(false);
  const over = data({ 'text/plain': 'hello' }, [], 'link');
  fire(zone, 'dragover', 'dataTransfer', over);
  expect(over.dropEffect).toBe('none');
  fire(zone, 'drop', 'dataTransfer', link);
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[0]).toEqual([]);
  const copy = data({ 'text/plain': 'hello' }, [], 'copyMove');
  fire(zone, 'dragenter', 'dataTransfer', copy);
  await page.waitFor(() => expect(state(page)[2]).toEqual(['copy', 'move']));
  expect(zone.hasAttribute('data-drop-target')).toBe(true);
});
