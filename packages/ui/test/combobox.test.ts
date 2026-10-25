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
  expect(state(page)).toEqual(['cherry', 'Cherry']);
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

it('closes on Escape, clears on a second Escape, and puts the text back on blur', async () => {
  const page = await comboboxes();
  const input = page.get('.input') as HTMLInputElement;
  input.focus();
  type(input, 'ban');
  await page.waitFor(() => expect(shown()).toEqual(['Banana']));
  press('ArrowDown', input);
  press('Enter', input);
  await page.waitFor(() => expect(state(page)[0]).toBe('banana'));
  // Text that matches no item, then focus that leaves, puts the selected text back.
  type(input, 'Banan');
  await page.waitFor(() => expect(find('.list')).not.toBeNull());
  press('Escape', input);
  await page.waitFor(() => expect(find('.list')).toBeNull());
  page.get('.after').focus();
  input.dispatchEvent(new FocusEvent('blur'));
  await page.waitFor(() => expect(input.value).toBe('Banana'));
  input.focus();
  press('Escape', input);
  await page.waitFor(() => expect(input.value).toBe(''));
  expect(state(page)[0]).toBe(null);
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
