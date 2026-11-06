// The tests of TextField and SearchField when a $bind setter refuses the text that the user typed.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import TextFieldRefused from './fixtures/text-field-refused.brm?brumate-server';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function refused() {
  const page = await mount(TextFieldRefused, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof refused>>;

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function input(page: Page, selector: string) {
  return page.get(selector) as HTMLInputElement | HTMLTextAreaElement;
}

/** Types the text with the caret at `caret`, as the browser leaves it after an edit. */
function type(page: Page, selector: string, text: string, caret = text.length) {
  const field = input(page, selector);
  field.focus();
  field.value = text;
  field.setSelectionRange(caret, caret);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Waits for the code of the page to load, so the first edit runs its setter at once. */
async function ready(_page: Page) {
  await wait(250);
}

it('shows the kept text at once when the setter refuses', async () => {
  const page = await refused();
  await ready(page);
  type(page, '.sync-input', 'abcx');
  await page.waitFor(() => expect(input(page, '.sync-input').value).toBe('abc'));
  type(page, '.area-input', 'abcx');
  await page.waitFor(() => expect(input(page, '.area-input').value).toBe('abc'));
  type(page, '.search-input', 'abcx');
  await page.waitFor(() => expect(input(page, '.search-input').value).toBe('abc'));
  expect(JSON.parse(page.text('.state'))).toEqual(['abc', 'abc', 'abc', 'abc', 'abc', 'abc']);
});

it('keeps the caret where it still fits', async () => {
  const page = await refused();
  await ready(page);
  const field = input(page, '.sync-input');
  // A character typed in the middle: "abXc", caret after the X.
  type(page, '.sync-input', 'abXc', 3);
  await page.waitFor(() => expect(field.value).toBe('abc'));
  expect([field.selectionStart, field.selectionEnd]).toEqual([2, 2]);
  // A character typed at the start: the caret stays at the start.
  type(page, '.sync-input', 'Xabc', 1);
  await page.waitFor(() => expect(field.value).toBe('abc'));
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, 0]);
  // A character typed at the end: the caret moves back to the end.
  type(page, '.sync-input', 'abcX', 4);
  await page.waitFor(() => expect(field.value).toBe('abc'));
  expect([field.selectionStart, field.selectionEnd]).toEqual([3, 3]);
});

it('leaves the typed text while an async setter decides, then restores it when it refuses', async () => {
  const page = await refused();
  await ready(page);
  type(page, '.slow-no-input', 'abcx');
  await wait(60);
  // The setter has not settled, so the input keeps what the user typed.
  expect(input(page, '.slow-no-input').value).toBe('abcx');
  await page.waitFor(() => expect(input(page, '.slow-no-input').value).toBe('abc'), 10000);
  type(page, '.slow-search-input', 'abcx');
  await wait(60);
  expect(input(page, '.slow-search-input').value).toBe('abcx');
  await page.waitFor(() => expect(input(page, '.slow-search-input').value).toBe('abc'), 10000);
});

it('keeps the typed text when an async setter accepts later', async () => {
  const page = await refused();
  await ready(page);
  type(page, '.slow-yes-input', 'abcx');
  await wait(60);
  expect(input(page, '.slow-yes-input').value).toBe('abcx');
  await page.waitFor(() => expect(JSON.parse(page.text('.state'))[2]).toBe('abcx'), 10000);
  await wait(100);
  expect(input(page, '.slow-yes-input').value).toBe('abcx');
});

it('does not touch the input while a later keystroke waits', async () => {
  const page = await refused();
  await ready(page);
  const field = input(page, '.slow-no-input');
  type(page, '.slow-no-input', 'abcx');
  await wait(100);
  // A second keystroke while the first check runs.
  type(page, '.slow-no-input', 'abcxy');
  // The first check settles at 150 ms, and the second at about 250 ms.
  await wait(110);
  expect(field.value).toBe('abcxy');
  await page.waitFor(() => expect(field.value).toBe('abc'), 10000);
});
