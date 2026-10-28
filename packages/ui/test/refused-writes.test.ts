// The tests of parts that show the value their caller keeps when a $bind setter refuses a write.
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import RefusedWrites from './fixtures/refused-writes.brm?brumate-server';
import { press } from './interact.ts';

vi.setConfig({ testTimeout: 30000 });

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function refusals() {
  const page = await mount(RefusedWrites, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof refusals>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

const input = (page: Page, selector: string) => page.get(selector) as HTMLInputElement;

function type(element: HTMLInputElement, value: string) {
  element.focus();
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  press('Enter', element);
}

function slide(element: HTMLInputElement, value: number) {
  element.value = String(value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function step(page: Page, selector: string, key: string) {
  const segment = page.get(selector);
  segment.focus();
  press(key, segment);
}

const texts = (page: Page, selector: string) =>
  [...page.get(selector).querySelectorAll('[data-segment]')].map((item) => item.textContent);

/** Everything that the seven parts show: text, thumbs, segments, `data-*` and inputs. */
function shown(page: Page) {
  const values = (selector: string) =>
    [...document.querySelectorAll<HTMLInputElement>(selector)].map((item) => item.value);
  return {
    number: [input(page, '.number-input').value, ...values('.number input[type=hidden]')],
    hex: [input(page, '.hex-input').value, ...values('.hex input[type=hidden]')],
    slider: [
      ...values('.slider input'),
      page.get('.slider-thumb input').getAttribute('aria-valuetext'),
    ],
    area: values('.area input'),
    wheel: [...values('.wheel input'), page.get('.wheel input').getAttribute('aria-valuetext')],
    wheelThumb: page.get('.wheel-thumb').getAttribute('style'),
    time: [texts(page, '.time-input'), ...values('.time input')],
    picker: [
      input(page, '.pk-field-input').value,
      ...values('.pk-area input'),
      ...values('.pk-slider input'),
      page.get('.pk-swatch').getAttribute('style'),
    ],
    stay: [texts(page, '.stay-start'), texts(page, '.stay-end'), ...values('.stay input')],
  };
}

/** One refused edit for each part: typing, a thumb, and the arrow keys. */
async function edit(page: Page) {
  type(input(page, '.number-input'), '7');
  type(input(page, '.hex-input'), '#0000ff');
  slide(input(page, '.slider input'), 300);
  slide(input(page, '.area input'), 10);
  slide(input(page, '.wheel input'), 100);
  step(page, '.time-input [data-type="hour"]', 'ArrowUp');
  step(page, '.stay-start [data-type="day"]', 'ArrowUp');
  type(input(page, '.pk-field-input'), '#2563eb');
  slide(input(page, '.pk-slider input'), 120);
  await new Promise((done) => setTimeout(done, 100));
}

it('shows what the caller keeps when a setter refuses an edit or a reset', async () => {
  const page = await refusals();
  const first = shown(page);
  await edit(page);
  await page.waitFor(
    () =>
      expect(state(page).slice(0, 7)).toEqual([
        7,
        '#0000FF',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      ]),
    10000,
  );
  const edited = state(page);
  const kept = shown(page);
  expect(kept).not.toEqual(first);
  expect(edited[0]).toBe(7);
  expect(edited[1]).toBe('#0000FF');
  expect(edited[7]).not.toBe('hsb(210, 50%, 80%)');
  page.click('.hold');
  await page.waitFor(() => expect(page.text('.held-flag')).toBe('true'), 10000);
  // Edits that the setters refuse leave the display as it was.
  type(input(page, '.number-input'), '9');
  type(input(page, '.hex-input'), '#00ff00');
  slide(input(page, '.slider input'), 100);
  slide(input(page, '.area input'), 50);
  slide(input(page, '.wheel input'), 20);
  step(page, '.time-input [data-type="hour"]', 'ArrowUp');
  step(page, '.stay-start [data-type="day"]', 'ArrowUp');
  type(input(page, '.pk-field-input'), '#ff0000');
  slide(input(page, '.pk-area input'), 20);
  slide(input(page, '.pk-slider input'), 10);
  press('PageUp', input(page, '.number-input'));
  press('PageUp', input(page, '.hex-input'));
  step(page, '.stay-end [data-type="day"]', 'ArrowDown');
  await new Promise((done) => setTimeout(done, 100));
  expect(state(page)).toEqual(edited);
  expect(shown(page)).toEqual(kept);
  // A reset goes through the setters, which refuse it.
  (page.get('.form') as HTMLFormElement).reset();
  await new Promise((done) => setTimeout(done, 100));
  expect(state(page)).toEqual(edited);
  expect(shown(page)).toEqual(kept);
});

const checked = (selector: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`${selector} input`)].map((item) => item.checked);

it('puts the inputs of groups and boxes back after a refused click', async () => {
  const page = await refusals();
  // The setters take these clicks, and the first click of a part loads its code.
  page.get('.egg input').click();
  page.get('.large input').click();
  page.get('.box input').click();
  await page.waitFor(
    () => expect(state(page).slice(8, 11)).toEqual([['ham', 'egg'], 'large', true]),
    10000,
  );
  page.click('.hold');
  await page.waitFor(() => expect(page.text('.held-flag')).toBe('true'), 10000);
  page.get('.egg input').click();
  page.get('.small input').click();
  page.get('.box input').click();
  await new Promise((done) => setTimeout(done, 100));
  expect(state(page).slice(8, 11)).toEqual([['ham', 'egg'], 'large', true]);
  expect(checked('.toppings')).toEqual([true, true]);
  expect(checked('.sizes')).toEqual([false, true]);
  expect(checked('.box')).toEqual([true]);
  expect(page.get('.egg').hasAttribute('data-selected')).toBe(true);
  expect(page.get('.small').hasAttribute('data-selected')).toBe(false);
  expect(page.get('.large').hasAttribute('data-selected')).toBe(true);
});

it('keeps the input of a switch with the shown value while a setter waits to accept', async () => {
  const page = await refusals();
  const box = page.get('.later input') as HTMLInputElement;
  // The first click loads the code, and the setter takes it after its delay.
  box.click();
  await page.waitFor(
    () => expect(page.get('.later').hasAttribute('data-selected')).toBe(true),
    10000,
  );
  box.click();
  await new Promise((done) => setTimeout(done, 20));
  // The input and the shown value agree at every moment, also while the setter waits.
  const until = Date.now() + 1500;
  while (Date.now() < until) {
    expect(box.checked).toBe(page.get('.later').hasAttribute('data-selected'));
    // oxlint-disable-next-line no-await-in-loop -- It samples at intervals.
    await new Promise((done) => setTimeout(done, 5));
  }
  expect(box.checked).toBe(false);
  expect(page.get('.later').hasAttribute('data-selected')).toBe(false);
});
