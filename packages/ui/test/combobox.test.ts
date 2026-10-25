// The tests of ComboBox follow the tests of ComboBox in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ComboBoxes from './fixtures/comboboxes.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
});

async function comboboxes() {
  const page = await mount(ComboBoxes, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof comboboxes>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

/** Types into the input, as the browser does: its value, then `input`. */
function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const shown = () =>
  [...document.querySelectorAll<HTMLElement>('.list [role=option]')]
    .filter((item) => !item.hidden)
    .map((item) => item.textContent);

it('is a combobox that its label names, and is closed', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  expect(input.getAttribute('role')).toBe('combobox');
  expect(input.getAttribute('aria-autocomplete')).toBe('list');
  expect(input.getAttribute('aria-expanded')).toBe('false');
  expect(page.get('.label').getAttribute('for')).toBe(input.id);
  expect(page.get('.toggle').getAttribute('tabindex')).toBe('-1');
  expect(find('.list')).toBeNull();
});

it('opens as the user types, and shows the items that contain the text', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  type(input, 'ap');
  await page.waitFor(() => expect(shown()).toEqual(['Apple', 'Apricot']));
  expect(input.getAttribute('aria-expanded')).toBe('true');
  expect(input.getAttribute('aria-controls')).toBe(find('.list')!.id);
  // Focus stays in the input.
  expect(document.activeElement).toBe(input);
  type(input, 'apr');
  await page.waitFor(() => expect(shown()).toEqual(['Apricot']));
});

it('moves through the items with the arrow keys, and Enter picks one', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  press('ArrowDown', input);
  await page.waitFor(() => expect(find('.item-apple')!.hasAttribute('data-focused')).toBe(true));
  expect(input.getAttribute('aria-activedescendant')).toBe(find('.item-apple')!.id);
  expect(shown()).toEqual(['Apple', 'Apricot', 'Banana', 'Cherry']);
  press('ArrowDown', input);
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(find('.item-apricot')!.id),
  );
  press('ArrowUp', input);
  press('ArrowUp', input);
  // The keys go round.
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(find('.item-cherry')!.id),
  );
  press('Enter', input);
  await page.waitFor(() => expect(find('.list')).toBeNull());
  expect(input.value).toBe('Cherry');
  expect(state(page)).toEqual(['cherry', 'Cherry', null]);
  expect((page.get('.fruit input[type=hidden]') as HTMLInputElement).value).toBe('cherry');
});

it('picks an item with a press, and the Button shows all the items', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  pressWith(page.get('.toggle'));
  await page.waitFor(() => expect(shown()).toEqual(['Apple', 'Apricot', 'Banana', 'Cherry']));
  await page.waitFor(() => expect(document.activeElement).toBe(input));
  pressWith(find('.item-banana')!);
  await page.waitFor(() => expect(find('.list')).toBeNull());
  expect(input.value).toBe('Banana');
  expect(state(page)[0]).toBe('banana');
});

it('puts the text of the selection back on Escape and on blur, and keeps the selection', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  type(input, 'ban');
  await page.waitFor(() => expect(shown()).toEqual(['Banana']));
  press('ArrowDown', input);
  press('Enter', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('banana'));
  // Escape closes the list and puts the selected text back, as revert of React Aria does.
  type(input, 'Banan');
  await page.waitFor(() => expect(find('.list')).not.toBeNull());
  press('Escape', input);
  await page.waitFor(() => expect(find('.list')).toBeNull());
  await page.waitFor(() => expect(input.value).toBe('Banana'));
  // Focus that leaves does the same.
  type(input, 'Ban');
  page.get('.after').focus();
  input.dispatchEvent(new FocusEvent('blur'));
  await page.waitFor(() => expect(input.value).toBe('Banana'));
  // A second Escape keeps the selection.
  input.focus();
  press('Escape', input);
  await new Promise((done) => setTimeout(done, 50));
  expect(state(page)[0]).toBe('banana');
  expect(input.value).toBe('Banana');
});

it('clears text that matches nothing on Escape when nothing is selected', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  type(input, 'ban');
  await page.waitFor(() => expect(find('.list')).not.toBeNull());
  press('Escape', input);
  await page.waitFor(() => expect(input.value).toBe(''));
});

it('keeps focus in the input on a press of the Button, which toggles the list', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  type(input, 'ap');
  await page.waitFor(() => expect(find('.list')).not.toBeNull());
  const button = page.get('.fruit button');
  // The pointer focuses the Button for a moment, and the input blurs.
  button.focus();
  input.dispatchEvent(new FocusEvent('blur'));
  pressWith(button);
  await page.waitFor(() => expect(find('.list')).toBeNull());
  await page.waitFor(() => expect(document.activeElement).toBe(input));
  await new Promise((done) => setTimeout(done, 50));
  expect(find('.list')).toBeNull();
  expect(input.value).toBe('ap');
});

it('closes when nothing matches', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  type(input, 'a');
  await page.waitFor(() => expect(find('.list')).not.toBeNull());
  type(input, 'xyz');
  await page.waitFor(() => expect(find('.list')).toBeNull());
  expect(input.getAttribute('aria-expanded')).toBe('false');
});

it('keeps custom text, which clears the selection and goes with the form', async () => {
  const page = await comboboxes();
  const input = page.get('.tag-input') as HTMLInputElement;
  expect(input.required).toBe(true);
  expect(input.getAttribute('aria-required')).toBe('true');
  input.focus();
  type(input, 're');
  await page.waitFor(() => expect(find('.tag-list')).not.toBeNull());
  press('ArrowDown', input);
  press('Enter', input);
  await page.waitFor(() => expect(state(page)[2]).toBe('red'));
  type(input, 'Reddish');
  page.get('.after').focus();
  input.dispatchEvent(new FocusEvent('blur'));
  await page.waitFor(() => expect(state(page)[2]).toBe(null));
  expect(input.value).toBe('Reddish');
  const data = new FormData(page.get('.form') as HTMLFormElement);
  expect(data.get('tag')).toBe('Reddish');
});
