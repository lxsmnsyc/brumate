// The tests of validation and of the keys of a search field follow those of useFormValidation,
// TextField, SearchField and Form in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Validation from './fixtures/validation.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function validation() {
  const page = await mount(Validation, {});
  unmount = page.unmount;
  return page;
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(input: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  input.dispatchEvent(event);
  return event;
}

it('gives a form with the aria behavior novalidate, so the browser never blocks it', async () => {
  const page = await validation();
  expect((page.get('.aria-form') as HTMLFormElement).noValidate).toBe(true);
  expect((page.get('.native-form') as HTMLFormElement).noValidate).toBe(false);
});

it('blocks a form from the first value with validate, the errors of the server and isInvalid', async () => {
  const page = await validation();
  // The user never typed in these fields.
  const code = page.get('.code-input') as HTMLInputElement;
  const handle = page.get('.handle-input') as HTMLInputElement;
  const flagged = page.get('.flagged-input') as HTMLInputElement;
  await page.waitFor(() => expect(code.validationMessage).toBe('At least 3 letters'));
  await page.waitFor(() => expect(handle.validationMessage).toBe('That handle is taken'));
  await page.waitFor(() => expect(flagged.validationMessage).toBe('Invalid value.'));
  expect((page.get('.native-form') as HTMLFormElement).checkValidity()).toBe(false);
});

it('blocks a form with isInvalid in the native behavior, as the browser checks it', async () => {
  const page = await validation();
  const input = page.get('.flagged-input') as HTMLInputElement;
  type(input, 'anything');
  await page.waitFor(() => expect(input.validationMessage).toBe('Invalid value.'));
  expect((page.get('.native-form') as HTMLFormElement).checkValidity()).toBe(false);
});

it('shows one source of errors: those of the field, not the message of the browser too', async () => {
  const page = await validation();
  const input = page.get('.order-input') as HTMLInputElement;
  // The browser finds the email invalid too, and sends invalid.
  input.dispatchEvent(new Event('invalid', { cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.order-error')).toBe('Write a whole email address');
});

it('shows new errors of the server after the user edited the field', async () => {
  const page = await validation();
  const handle = page.get('.handle-input') as HTMLInputElement;
  type(handle, 'grace');
  await page.waitFor(() => expect(page.container.querySelector('.handle-error')).toBeNull());
  // A later reply gives the same field an error again.
  page.get('.reply').click();
  await page.waitFor(() => expect(page.text('.handle-error')).toBe('That handle is taken'));
});

it('gives a field its first value back when its form is reset', async () => {
  const page = await validation();
  const input = page.get('.title-input') as HTMLInputElement;
  type(input, 'Final');
  await page.waitFor(() => expect(page.text('.title-value')).toBe('Final'));
  (page.get('.native-form') as HTMLFormElement).reset();
  await page.waitFor(() => expect(page.text('.title-value')).toBe('Draft'));
  await page.waitFor(() => expect(input.value).toBe('Draft'));
});

it('prevents Enter in a search field, so it sends no form, and Escape only while it has text', async () => {
  const page = await validation();
  const input = page.get('.find-input');
  expect(key(input, 'Enter').defaultPrevented).toBe(true);
  // An empty field keeps Escape, so a dialog around it closes, and it calls no onClear.
  expect(key(input, 'Escape').defaultPrevented).toBe(false);
  await page.waitFor(() => expect(page.text('.searched')).toBe('1'));
  type(input as HTMLInputElement, 'dogs');
  await page.waitFor(() => expect(page.get('.find').hasAttribute('data-empty')).toBe(false));
  await page.waitFor(() => expect(key(input, 'Escape').defaultPrevented).toBe(true));
  await page.waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  expect(page.text('.clears')).toBe('1');
});

it('sends nothing for Enter while an input method composes', async () => {
  const page = await validation();
  const input = page.get('.find-input');
  const event = key(input, 'Enter', { isComposing: true });
  expect(event.defaultPrevented).toBe(false);
  key(input, 'Enter');
  await page.waitFor(() => expect(page.text('.searched')).toBe('1'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(page.text('.searched')).toBe('1');
});

it('neither clears nor sends a read-only search field', async () => {
  const page = await validation();
  const input = page.get('.locked-input') as HTMLInputElement;
  key(input, 'Escape');
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(input.value).toBe('cats');
  expect(page.text('.clears')).toBe('0');
});
