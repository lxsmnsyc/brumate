// The native error of a field clears once its value is valid again.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import FieldErrors from './fixtures/field-errors.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function fields() {
  const page = await mount(FieldErrors, {});
  unmount = page.unmount;
  return page;
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function blur(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent('blur'));
}

// A submit makes the browser fire invalid on each field that fails.
function submit(input: HTMLInputElement) {
  input.dispatchEvent(new Event('invalid', { cancelable: true }));
}

it('clears the error of a ColorField once the color is valid', async () => {
  const page = await fields();
  const input = page.get('.color-input') as HTMLInputElement;
  submit(input);
  await page.waitFor(() => expect(page.container.querySelector('.color-error')).not.toBeNull());
  expect(page.get('.color').getAttribute('data-invalid')).toBe('true');
  type(input, 'f0f');
  blur(input);
  await page.waitFor(() => expect(page.container.querySelector('.color-error')).toBeNull());
  expect(page.get('.color').hasAttribute('data-invalid')).toBe(false);
  expect(input.value).toBe('#FF00FF');
});

it('clears the error of a NumberField once the number is valid', async () => {
  const page = await fields();
  const input = page.get('.number-input') as HTMLInputElement;
  submit(input);
  await page.waitFor(() => expect(page.container.querySelector('.number-error')).not.toBeNull());
  expect(page.get('.number').getAttribute('data-invalid')).toBe('true');
  type(input, '3');
  blur(input);
  await page.waitFor(() => expect(page.container.querySelector('.number-error')).toBeNull());
  expect(page.get('.number').hasAttribute('data-invalid')).toBe(false);
});
