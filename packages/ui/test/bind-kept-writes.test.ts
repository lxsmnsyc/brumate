// The tests of parts whose setter throws, or keeps a copy of the old value.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import BindKeptWrites from './fixtures/bind-kept-writes.brm?brumate-server';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function kept() {
  const page = await mount(BindKeptWrites, {});
  unmount = page.unmount;
  // The code of the page loads. The first load compiles it, which takes seconds on a busy machine.
  await page.waitFor(() => expect(page.text('.ready')).toBe('ready'), 20_000);
  return page;
}

function hide(event: Event) {
  event.preventDefault();
}

it('puts the input of a Switch back when the setter throws', async () => {
  // The error reaches the page, which the test does not need to see.
  window.addEventListener('error', hide);
  window.addEventListener('unhandledrejection', hide);
  try {
    const page = await kept();
    const input = page.get('.power input') as HTMLInputElement;
    input.click();
    await page.waitFor(() => expect(input.checked).toBe(false));
    expect(page.get('.power').hasAttribute('data-selected')).toBe(false);
  } finally {
    window.removeEventListener('error', hide);
    window.removeEventListener('unhandledrejection', hide);
  }
});

it('does not call the handler when a setter keeps a copy with the same items', async () => {
  const page = await kept();
  (page.get('.egg input') as HTMLInputElement).click();
  (page.get('.item-b') as HTMLElement).click();
  const thumb = page.get('.low input') as HTMLInputElement;
  thumb.value = '30';
  thumb.dispatchEvent(new Event('input', { bubbles: true }));
  // The thumb goes back once the events ran, in order, so the handlers had their chance by then.
  await page.waitFor(() => expect(thumb.value).toBe('20'));
  expect(JSON.parse(page.text('.heard'))).toEqual([]);
});
