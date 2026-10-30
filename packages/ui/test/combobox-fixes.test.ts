// The tests of the fixes of ComboBox, Select and Autocomplete.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ComboBoxFixes from './fixtures/combobox-fixes.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function fixes() {
  const page = await mount(ComboBoxFixes, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof fixes>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

it('(a) shows a server error that arrives after a pick', async () => {
  const page = await fixes();
  const input = page.get('.fruit-input') as HTMLInputElement;
  input.focus();
  press('ArrowDown', input);
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(find('.fruit-apple')!.id),
  );
  press('Enter', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('apple'));
  const trigger = page.get('.size-trigger');
  trigger.focus();
  press('ArrowDown', trigger);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.size-small')));
  press('Enter');
  await page.waitFor(() => expect(state(page)[1]).toBe('small'));
  page.get('.reply').click();
  await page.waitFor(() => expect(page.get('.fruit-error').textContent).toBe('No fruit today'));
  await page.waitFor(() => expect(page.get('.size-error').textContent).toBe('No size today'));
  expect(page.get('.fruit').hasAttribute('data-invalid')).toBe(true);
  expect(page.get('.size').hasAttribute('data-invalid')).toBe(true);
  // A pick after the reply hides it again.
  input.focus();
  press('ArrowDown', input);
  await page.waitFor(() => expect(input.getAttribute('aria-activedescendant')).not.toBeNull());
  press('ArrowDown', input);
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(find('.fruit-banana')!.id),
  );
  press('Enter', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('banana'));
  await page.waitFor(() => expect(page.get('.fruit').hasAttribute('data-invalid')).toBe(false));
});

it('(b) copies the message of the browser for isRequired into the FieldError', async () => {
  const page = await fixes();
  const need = page.get('.need-input') as HTMLInputElement;
  expect(need.checkValidity()).toBe(false);
  need.dispatchEvent(new Event('invalid', { cancelable: true }));
  await page.waitFor(() => expect(page.get('.need-error').textContent).not.toBe(''));
  expect(page.get('.need').hasAttribute('data-invalid')).toBe(true);
  expect(need.getAttribute('aria-invalid')).toBe('true');
  // Text in the field makes it valid, and the message goes.
  need.focus();
  type(need, 'x');
  await page.waitFor(() => expect(page.get('.need').hasAttribute('data-invalid')).toBe(false));
});

it('(c) shows the kept item when a setter refuses the pick, also after Tab', async () => {
  const page = await fixes();
  const input = page.get('.held-input') as HTMLInputElement;
  page.get('.hold').click();
  input.focus();
  press('ArrowDown', input);
  await page.waitFor(() => expect(input.getAttribute('aria-activedescendant')).not.toBeNull());
  press('ArrowDown', input);
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(find('.held-banana')!.id),
  );
  press('Enter', input);
  // The key stays, and so does its text. The handler does not hear a pick that was refused.
  await page.waitFor(() => expect(input.value).toBe('Apple'));
  expect(state(page)[2]).toBe('apple');
  expect(state(page)[3]).toEqual([]);
  press('Tab', input);
  page.get('.after').focus();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(input.value).toBe('Apple');
  expect(state(page)[2]).toBe('apple');
});

it('(d) filters by a text that code writes to a bound inputValue', async () => {
  const page = await fixes();
  page.get('.write').click();
  await page.waitFor(() => expect(state(page)[4]).toBe('ban'));
  await page.waitFor(() => expect(page.get('.search-apple').hidden).toBe(true));
  expect(page.get('.search-banana').hidden).toBe(false);
});

it('(b) shows the required message again when the field is cleared after a check', async () => {
  const page = await fixes();
  const need = page.get('.need-input') as HTMLInputElement;
  need.dispatchEvent(new Event('invalid', { cancelable: true }));
  await page.waitFor(() => expect(page.get('.need-error').textContent).not.toBe(''));
  need.focus();
  type(need, 'x');
  await page.waitFor(() => expect(page.get('.need').hasAttribute('data-invalid')).toBe(false));
  type(need, '');
  await page.waitFor(() => expect(page.get('.need').hasAttribute('data-invalid')).toBe(true));
  expect(page.get('.need-error').textContent).not.toBe('');
});

it('(d) filters by the text of the field when a setter refuses it', async () => {
  const page = await fixes();
  const input = page.get('.refusing-input') as HTMLInputElement;
  input.focus();
  type(input, 'bana');
  await page.waitFor(() => expect(page.get('.refusing-apple').hidden).toBe(true));
  expect(page.get('.refusing-banana').hidden).toBe(false);
  expect(state(page)[5]).toBe('');
});
