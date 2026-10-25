// The tests of NumberField follow the tests of NumberField in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import NumberFields from './fixtures/numberfields.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function numberfields() {
  const page = await mount(NumberFields, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof numberfields>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

it('formats the number, names its buttons by the label, and keeps them out of Tab', async () => {
  const page = await numberfields();
  const input = page.get('.input') as HTMLInputElement;
  expect(input.value).toBe('10');
  expect(input.getAttribute('inputmode')).toBe('numeric');
  expect(input.getAttribute('aria-roledescription')).toBe('Number field');
  expect(page.get('.label').getAttribute('for')).toBe(input.id);
  const plus = page.get('.plus');
  expect(plus.getAttribute('aria-label')).toBe('Increase');
  expect(plus.getAttribute('aria-labelledby')).toBe(`${plus.id} ${page.get('.label').id}`);
  expect(plus.getAttribute('aria-controls')).toBe(input.id);
  expect(plus.getAttribute('tabindex')).toBe('-1');
  expect(page.get('.group').getAttribute('role')).toBe('group');
  // The locale and the format options shape the number.
  expect((page.get('.price-input') as HTMLInputElement).value).toBe('1.234,50\u00a0€');
  expect((page.get('.width input[type=hidden]') as HTMLInputElement).value).toBe('10');
});

it('steps with the arrow keys, Home and End, and stops at the range', async () => {
  const page = await numberfields();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  press('ArrowUp', input);
  await page.waitFor(() => expect(input.value).toBe('15'));
  press('ArrowUp', input);
  press('ArrowUp', input);
  await page.waitFor(() => expect(input.value).toBe('20'));
  await page.waitFor(() => expect(page.get('.plus').hasAttribute('disabled')).toBe(true));
  press('Home', input);
  await page.waitFor(() => expect(input.value).toBe('0'));
  press('PageDown', input);
  await new Promise((done) => setTimeout(done, 50));
  expect(input.value).toBe('0');
  press('End', input);
  await page.waitFor(() => expect(state(page)[0]).toBe(20));
});

it('snaps typed text to the range and the step when focus leaves', async () => {
  const page = await numberfields();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  type(input, '12');
  input.dispatchEvent(new FocusEvent('blur'));
  await page.waitFor(() => expect(input.value).toBe('10'));
  type(input, '99');
  input.dispatchEvent(new FocusEvent('blur'));
  await page.waitFor(() => expect(input.value).toBe('20'));
  expect(state(page)[0]).toBe(20);
  // Text that cannot become a number does not stay.
  type(input, '1x');
  await page.waitFor(() => expect(input.value).toBe('20'));
});

it('steps with the Buttons, again while one is held', async () => {
  const page = await numberfields();
  const input = page.get('.input') as HTMLInputElement;
  const minus = page.get('.minus');
  pointer('pointerdown', minus);
  await page.waitFor(() => expect(input.value).toBe('5'));
  // Held, it steps again after a moment.
  await page.waitFor(() => expect(input.value).toBe('0'));
  pointer('pointerup', minus);
  expect(document.activeElement).toBe(input);
  pointer('pointerdown', page.get('.plus'));
  pointer('pointerup', page.get('.plus'));
  await page.waitFor(() => expect(input.value).toBe('5'));
  await new Promise((done) => setTimeout(done, 500));
  expect(input.value).toBe('5');
});

it('reads a number in the format of the locale, and an empty field is NaN', async () => {
  const page = await numberfields();
  const price = page.get('.price-input') as HTMLInputElement;
  price.focus();
  type(price, '99,9');
  press('Enter', price);
  await page.waitFor(() => expect(price.value).toBe('99,90\u00a0€'));
  expect(state(page)[1]).toBe(99.9);
  const empty = page.get('.empty-input') as HTMLInputElement;
  expect(empty.value).toBe('');
  empty.focus();
  press('ArrowUp', empty);
  await page.waitFor(() => expect(empty.value).toBe('0'));
  type(empty, '');
  empty.dispatchEvent(new FocusEvent('blur'));
  await page.waitFor(() => expect(state(page)[2]).toBe('NaN'));
});

const keyDown = (key: string, target: Element, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

it('names the input and its Buttons by aria-label, and disables a Button a step would pass', async () => {
  const page = await numberfields();
  const input = page.get('.qty-input') as HTMLInputElement;
  expect(input.getAttribute('aria-label')).toBe('Quantity');
  expect(input.required).toBe(true);
  expect(page.get('.qty-plus').getAttribute('aria-label')).toBe('Increase Quantity');
  await page.waitFor(() => expect(page.get('.qty-plus').hasAttribute('aria-labelledby')).toBe(false));
  // 10 + 5 passes the maximum of 12, as in React Aria.
  expect(page.get('.qty-plus').hasAttribute('disabled')).toBe(true);
  expect(page.get('.qty-minus').hasAttribute('disabled')).toBe(false);
});

it('sends what was typed, and a reset gives back the first number', async () => {
  const page = await numberfields();
  const input = page.get('.qty-input') as HTMLInputElement;
  const hidden = page.get('.qty input[type=hidden]') as HTMLInputElement;
  input.focus();
  type(input, '7');
  // Enter submits before the code commits, so the form reads the typed number.
  await page.waitFor(() => expect(hidden.value).toBe('7'));
  input.blur();
  await page.waitFor(() => expect(input.value).toBe('5'));
  (page.get('.form') as HTMLFormElement).reset();
  await page.waitFor(() => expect(input.value).toBe('10'));
  expect(hidden.value).toBe('10');
});

it('prevents Home and End only with a limit, and keys with a modifier do not step', async () => {
  const page = await numberfields();
  const input = page.get('.qty-input') as HTMLInputElement;
  input.focus();
  press('ArrowDown', input, { shiftKey: true });
  await new Promise((done) => setTimeout(done, 50));
  expect(input.value).toBe('10');
  expect(keyDown('Home', page.get('.empty-input'))).toBe(false);
  // A field that cannot change keeps its keys.
  expect(keyDown('ArrowUp', page.get('.locked-input'))).toBe(false);
  expect(keyDown('Home', input)).toBe(true);
  await page.waitFor(() => expect(input.value).toBe('0'));
});
