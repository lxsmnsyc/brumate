// The tests of Autocomplete follow the tests of Autocomplete in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Autocompletes from './fixtures/autocompletes.brm?brumate-server';
import { pointer, press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

async function autocompletes() {
  const page = await mount(Autocompletes, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof autocompletes>>;

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const shown = (page: Page, list: string) =>
  [...page.get(list).querySelectorAll<HTMLElement>('[data-key]')]
    .filter((item) => !item.hidden)
    .map((item) => item.textContent);

it('names the collection on the input, which keeps focus while the keys move', async () => {
  const page = await autocompletes();
  const input = page.get('.search-input') as HTMLInputElement;
  const menu = page.get('.commands');
  // The markup names the collection, before the code loads.
  expect(input.getAttribute('aria-controls')).toBe(menu.id);
  expect(input.getAttribute('aria-autocomplete')).toBe('list');
  expect(menu.getAttribute('tabindex')).toBe('-1');
  input.focus();
  press('ArrowDown', input);
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(page.get('.new').id),
  );
  await page.waitFor(() => expect(page.get('.new').hasAttribute('data-focused')).toBe(true));
  press('ArrowUp', input);
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(page.get('.save').id),
  );
  expect(document.activeElement).toBe(input);
});

it('filters the items as the user types, and makes the first one active', async () => {
  const page = await autocompletes();
  const input = page.get('.search-input') as HTMLInputElement;
  input.focus();
  type(input, 'file');
  await page.waitFor(() => expect(shown(page, '.commands')).toEqual(['New file', 'Open file']));
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(page.get('.new').id),
  );
  expect(state(page)[1]).toBe('file');
  type(input, 'op');
  await page.waitFor(() => expect(shown(page, '.commands')).toEqual(['Open file']));
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(page.get('.open').id),
  );
});

it('acts on the active item of a menu with Enter', async () => {
  const page = await autocompletes();
  const input = page.get('.search-input') as HTMLInputElement;
  input.focus();
  type(input, 'sa');
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(page.get('.save').id),
  );
  press('Enter', input);
  await page.waitFor(() => expect(state(page)[0]).toEqual(['save']));
});

it('shows all the items again when Escape clears the field', async () => {
  const page = await autocompletes();
  const input = page.get('.search-input') as HTMLInputElement;
  input.focus();
  type(input, 'sa');
  await page.waitFor(() => expect(shown(page, '.commands')).toEqual(['Save']));
  press('Escape', input);
  await page.waitFor(() =>
    expect(shown(page, '.commands')).toEqual(['New file', 'Open file', 'Save']),
  );
  expect(input.hasAttribute('aria-activedescendant')).toBe(false);
});

it('selects the active item of a list box with Enter, and the pointer makes one active', async () => {
  const page = await autocompletes();
  const input = page.get('.fruit-input') as HTMLInputElement;
  input.focus();
  pointer('pointerenter', page.get('.banana'));
  await page.waitFor(() =>
    expect(input.getAttribute('aria-activedescendant')).toBe(page.get('.banana').id),
  );
  press('Enter', input);
  await page.waitFor(() => expect(state(page)[2]).toEqual(['banana']));
  await page.waitFor(() => expect(page.get('.banana').getAttribute('aria-selected')).toBe('true'));
});
