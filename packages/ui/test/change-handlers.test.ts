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

it('tells the handler the value that the user asked for, and shows the value that the setter keeps', async () => {
  const page = await handlers();
  type(page, '.number-input', '14');
  await page.waitFor(() => expect(state(page)[0]).toEqual([['number', 14]]), 10000);
  // The setter rounds to the 10 that it keeps, and the field shows that one.
  await page.waitFor(() => expect(state(page)[2]).toBe(10));
  await page.waitFor(() =>
    expect((page.get('.number-input') as HTMLInputElement).value).toBe('10'),
  );
  type(page, '.hex-input', '#123abc');
  await page.waitFor(() => expect(state(page)[0]).toHaveLength(2), 10000);
  expect(String(state(page)[0][1]![1]).toLowerCase()).toBe('#123abc');
  await page.waitFor(() => expect(state(page)[3]).toBe('#123ABC'));
  await page.waitFor(() =>
    expect((page.get('.hex-input') as HTMLInputElement).value).toBe('#123ABC'),
  );
});

it('tells the handler the value that the user asked for when a setter refuses, and keeps the display', async () => {
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
  await page.waitFor(() => expect(state(page)[1]).toHaveLength(8), 10000);
  await new Promise((done) => setTimeout(done, 200));
  const calls = Object.fromEntries(state(page)[0] as [string, unknown][]);
  expect(calls).toEqual({
    text: 'ab',
    search: 'qq',
    slider: 70,
    box: true,
    power: true,
    sizes: 'large',
    toppings: ['ham', 'egg'],
    fruit: 'pear',
  });
  // The setters kept the old values, and so do the parts and their inputs.
  expect(thumb.value).toBe('50');
  for (const selector of ['.box', '.power', '.large', '.egg']) {
    expect((page.get(`${selector} input`) as HTMLInputElement).checked).toBe(false);
    expect(page.get(selector).hasAttribute('data-selected')).toBe(false);
  }
});
