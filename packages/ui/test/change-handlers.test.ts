// The tests of the change handlers when a $bind setter changes or refuses a write.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ChangeHandlers from './fixtures/change-handlers.brm?brumate-server';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
});

async function handlers() {
  const page = await mount(ChangeHandlers, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof handlers>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as [unknown[][], string[], number, string | null];
}

function type(page: Page, selector: string, value: string) {
  const input = page.get(selector) as HTMLInputElement;
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('blur'));
}

it('gives the handler the value that a rounding or uppercasing setter keeps, and only when it changed', async () => {
  const page = await handlers();
  type(page, '.number-input', '14');
  await page.waitFor(() => expect(state(page)[0]).toEqual([['number', 10]]), 10000);
  // 12 rounds to the 10 that was kept before, so nothing changed.
  const before = state(page)[0].length;
  type(page, '.number-input', '12');
  await new Promise((done) => setTimeout(done, 200));
  expect(state(page)[0]).toHaveLength(before);
  expect((page.get('.number-input') as HTMLInputElement).value).toBe('10');
  type(page, '.hex-input', '#123abc');
  await page.waitFor(() => expect(state(page)[0]).toContainEqual(['hex', '#123ABC']), 10000);
  expect((page.get('.hex-input') as HTMLInputElement).value).toBe('#123ABC');
  expect(state(page)[3]).toBe('#123ABC');
});

it('calls no change handler when a setter refuses', async () => {
  const page = await handlers();
  type(page, '.text-input', 'ab');
  type(page, '.search-input', 'qq');
  const thumb = page.get('.slider-thumb input') as HTMLInputElement;
  thumb.value = '70';
  thumb.dispatchEvent(new Event('input', { bubbles: true }));
  (page.get('.box input') as HTMLInputElement).click();
  (page.get('.power input') as HTMLInputElement).click();
  (page.get('.large input') as HTMLInputElement).click();
  (page.get('.egg input') as HTMLInputElement).click();
  (page.get('.fruit-trigger') as HTMLElement).click();
  await page.waitFor(() => expect(document.querySelector('.pear')).not.toBeNull(), 10000);
  (document.querySelector('.pear') as HTMLElement).click();
  // Every setter ran, and none of them kept the value.
  await page.waitFor(
    () =>
      expect([...state(page)[1]].toSorted()).toEqual([
        'box',
        'fruit',
        'power',
        'search',
        'sizes',
        'slider',
        'text',
        'toppings',
      ]),
    10000,
  );
  await new Promise((done) => setTimeout(done, 200));
  expect(state(page)[0]).toEqual([]);
});
