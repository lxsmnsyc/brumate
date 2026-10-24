// The tests of the fields follow the tests of TextField, SearchField and Form in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Fields from './fixtures/fields.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function fields() {
  const page = await mount(Fields, {});
  unmount = page.unmount;
  return page;
}

function type(input: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

it('names its input with the label, and describes it with the description', async () => {
  const page = await fields();
  const input = page.get('.email-input') as HTMLInputElement;
  const label = page.get('.email label');
  expect(label.getAttribute('for')).toBe(input.id);
  expect(input.getAttribute('type')).toBe('email');
  expect(input.getAttribute('name')).toBe('email');
  expect(input.required).toBe(true);
  const description = page.get('.email [slot], .email span');
  expect(input.getAttribute('aria-describedby')).toBe(description.id);
  expect(page.get('.email').hasAttribute('data-required')).toBe(true);
});

it('writes the bound value as the user types', async () => {
  const page = await fields();
  type(page.get('.email-input') as HTMLInputElement, 'ada@example.com');
  await page.waitFor(() => expect(page.text('.email-value')).toBe('ada@example.com'));
});

it('shows the message of the browser after a submit, and follows the value after that', async () => {
  const page = await fields();
  const input = page.get('.email-input') as HTMLInputElement;
  expect(page.container.querySelector('.email-error')).toBeNull();
  // The browser checks the form, and sends invalid to each invalid field.
  expect((page.get('.form') as HTMLFormElement).checkValidity()).toBe(false);
  await page.waitFor(() => expect(page.container.querySelector('.email-error')).not.toBeNull());
  const error = page.get('.email-error');
  expect(error.textContent!.length).toBeGreaterThan(0);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('aria-describedby')).toContain(error.id);
  expect(page.get('.email').hasAttribute('data-invalid')).toBe(true);
  type(input, 'ada@example.com');
  await page.waitFor(() => expect(page.container.querySelector('.email-error')).toBeNull());
  expect(input.hasAttribute('aria-invalid')).toBe(false);
});

it('prevents the message of the browser, which the field shows itself', async () => {
  const page = await fields();
  const input = page.get('.email-input') as HTMLInputElement;
  const event = new Event('invalid', { cancelable: true });
  input.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

it('shows the errors of the server until the user edits the field', async () => {
  const page = await fields();
  const input = page.get('.handle-input') as HTMLInputElement;
  expect(input.value).toBe('ada');
  expect(page.text('.handle-error')).toBe('That handle is taken');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  type(input, 'ada2');
  await page.waitFor(() => expect(page.container.querySelector('.handle-error')).toBeNull());
});

it('validates at once with the aria behavior, and never blocks the form', async () => {
  const page = await fields();
  const input = page.get('.code-input') as HTMLInputElement;
  // The empty value is checked on the server too.
  expect(page.text('.code-error')).toBe('At least 3 letters');
  type(input, 'abcd');
  await page.waitFor(() => expect(page.container.querySelector('.code-error')).toBeNull());
  expect(input.required).toBe(false);
});

it('gives a TextArea its value as its text', async () => {
  const page = await fields();
  const area = page.get('.note-input') as HTMLTextAreaElement;
  expect(area.tagName).toBe('TEXTAREA');
  expect(page.get('.note label').getAttribute('for')).toBe(area.id);
  type(area, 'Two\nlines');
  await page.waitFor(() => expect(area.value).toBe('Two\nlines'));
});

it('clears a SearchField with its button and with Escape, and submits with Enter', async () => {
  const page = await fields();
  const input = page.get('.search-input') as HTMLInputElement;
  expect(input.getAttribute('type')).toBe('search');
  const clear = page.get('.clear');
  expect(clear.getAttribute('aria-label')).toBe('Clear search');
  expect(clear.getAttribute('tabindex')).toBe('-1');
  input.focus();
  press('Enter', input);
  await page.waitFor(() => expect(page.text('.query')).toBe('cats|cats'));
  pressWith(clear);
  await page.waitFor(() => expect(page.text('.query')).toBe('|cats'));
  expect(page.get('.search').hasAttribute('data-empty')).toBe(true);
  type(input, 'dogs');
  await page.waitFor(() => expect(page.text('.query')).toBe('dogs|cats'));
  press('Escape', input);
  await page.waitFor(() => expect(page.text('.query')).toBe('|cats'));
  expect(input.value).toBe('');
});

it('takes a field of createForm: its name, ID, value and errors', async () => {
  const page = await fields();
  const input = page.get('.form-input') as HTMLInputElement;
  expect(input.id).toBe('order-email');
  expect(input.name).toBe('email');
  expect(input.value).toBe('ada@');
  expect(page.get('.from-form label').getAttribute('for')).toBe('order-email');
  const error = page.get('.form-error');
  expect(error.id).toBe('order-email-error');
  expect(error.getAttribute('role')).toBe('alert');
  expect(error.textContent).toBe('Write a whole email address');
  expect(input.getAttribute('aria-describedby')).toContain('order-email-error');
});
