// The tests of TextField and SearchField when a $bind setter refuses the text that the user typed.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import TextFieldRefused from './fixtures/text-field-refused.brm?brumate-server';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
// The async checks of the page, which wait until the test calls them.
const globals = globalThis as { held?: (() => void)[] };
beforeEach(() => {
  globals.held = [];
});
afterEach(() => {
  unmount?.();
  for (const release of globals.held ?? []) {
    release();
  }
});

async function refused() {
  const page = await mount(TextFieldRefused, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof refused>>;

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

/** Waits until a check of the page runs, and gives the one at `index`. */
async function check(page: Page, index: number) {
  await page.waitFor(() => expect(globals.held!.length).toBeGreaterThan(index), 10000);
  return globals.held![index]!;
}

/** Lets the promises that are ready run, so a check that must not act has had its turn. */
const turn = () => new Promise((done) => setTimeout(done, 0));

it('shows the kept text when the setter refuses', async () => {
  const page = await refused();
  type(page, '.sync-input', 'abcx');
  await page.waitFor(() => expect(input(page, '.sync-input').value).toBe('abc'), 10000);
  type(page, '.area-input', 'abcx');
  await page.waitFor(() => expect(input(page, '.area-input').value).toBe('abc'), 10000);
  type(page, '.search-input', 'abcx');
  await page.waitFor(() => expect(input(page, '.search-input').value).toBe('abc'), 10000);
  expect(JSON.parse(page.text('.state'))).toEqual(['abc', 'abc', 'abc', 'abc', 'abc', 'abc']);
});

it('keeps the caret where it still fits', async () => {
  const page = await refused();
  const field = input(page, '.sync-input');
  // A character typed in the middle: "abXc", caret after the X.
  type(page, '.sync-input', 'abXc', 3);
  await page.waitFor(() => expect(field.value).toBe('abc'), 10000);
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
  type(page, '.slow-no-input', 'abcx');
  const release = await check(page, 0);
  await turn();
  // The setter has not settled, so the input keeps what the user typed.
  expect(input(page, '.slow-no-input').value).toBe('abcx');
  release();
  await page.waitFor(() => expect(input(page, '.slow-no-input').value).toBe('abc'), 10000);
  type(page, '.slow-search-input', 'abcx');
  const releaseSearch = await check(page, 1);
  await turn();
  expect(input(page, '.slow-search-input').value).toBe('abcx');
  releaseSearch();
  await page.waitFor(() => expect(input(page, '.slow-search-input').value).toBe('abc'), 10000);
});

it('keeps the typed text when an async setter accepts later', async () => {
  const page = await refused();
  type(page, '.slow-yes-input', 'abcx');
  const release = await check(page, 0);
  await turn();
  expect(input(page, '.slow-yes-input').value).toBe('abcx');
  release();
  await page.waitFor(() => expect(JSON.parse(page.text('.state'))[2]).toBe('abcx'), 10000);
  await turn();
  expect(input(page, '.slow-yes-input').value).toBe('abcx');
});

it('does not touch the input while a later keystroke waits', async () => {
  const page = await refused();
  const field = input(page, '.slow-no-input');
  type(page, '.slow-no-input', 'abcx');
  const first = await check(page, 0);
  // A second keystroke while the first check runs.
  type(page, '.slow-no-input', 'abcxy');
  const second = await check(page, 1);
  first();
  await turn();
  await turn();
  expect(field.value).toBe('abcxy');
  second();
  await page.waitFor(() => expect(field.value).toBe('abc'), 10000);
});

it('waits for the end of a composition before it puts the kept text back', async () => {
  const page = await refused();
  const field = input(page, '.sync-input');
  // The first edit loads the code, and shows that the field answers.
  type(page, '.sync-input', 'abcx');
  await page.waitFor(() => expect(field.value).toBe('abc'), 10000);
  field.dispatchEvent(new Event('compositionstart', { bubbles: true }));
  type(page, '.sync-input', 'abcy');
  await turn();
  await turn();
  // The refusal does not end the session of the input method.
  expect(field.value).toBe('abcy');
  field.dispatchEvent(new Event('compositionend', { bubbles: true }));
  await page.waitFor(() => expect(field.value).toBe('abc'), 10000);
});
