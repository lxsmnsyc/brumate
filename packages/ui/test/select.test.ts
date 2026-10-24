// The tests of Select follow the tests of Select in React Aria.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Selects from './fixtures/selects.brm?brumate-server';
import { press, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  // A portal renders outside the mounted container, which unmount removes.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function selects() {
  const page = await mount(Selects, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof selects>>;

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function state(page: Page) {
  return JSON.parse(page.text('.state')) as unknown[];
}

it('names its Button by the value and the Label, and shows the placeholder', async () => {
  const page = await selects();
  const trigger = page.get('.trigger');
  expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(trigger.getAttribute('aria-labelledby')).toBe(
    `${page.get('.value').id} ${page.get('.animal-label').id}`,
  );
  expect(trigger.getAttribute('aria-describedby')).toContain(page.get('.animal-description').id);
  expect(page.text('.value')).toBe('Select an item');
  expect(page.get('.value').hasAttribute('data-placeholder')).toBe(true);
  // The value goes with the form, in an input out of sight and out of the order of Tab.
  const input = page.get('.animal input') as HTMLInputElement;
  expect(input.name).toBe('animal');
  expect(input.value).toBe('');
  expect(input.tabIndex).toBe(-1);
  expect(input.required).toBe(true);
});

it('opens with ArrowDown at the first item, and selects with Enter', async () => {
  const page = await selects();
  const trigger = page.get('.trigger');
  trigger.focus();
  press('ArrowDown', trigger);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cat')));
  const list = find('.list')!;
  expect(list.getAttribute('aria-labelledby')).toBe(page.get('.animal-label').id);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(trigger.getAttribute('aria-controls')).toBe(find('.popover')!.id);
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.dog')));
  press('Enter');
  await page.waitFor(() => expect(find('.list')).toBeNull());
  expect(document.activeElement).toBe(trigger);
  await page.waitFor(() => expect(page.text('.value')).toBe('Dog'));
  expect(page.get('.value').hasAttribute('data-placeholder')).toBe(false);
  expect(state(page).slice(0, 2)).toEqual(['dog', ['dog']]);
  expect((page.get('.animal input') as HTMLInputElement).value).toBe('dog');
});

it('opens with a press at the selected item, and a press selects and closes', async () => {
  const page = await selects();
  pressWith(page.get('.trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cat')));
  pressWith(find('.dog')!);
  await page.waitFor(() => expect(find('.list')).toBeNull());
  pressWith(page.get('.trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.dog')));
  expect(find('.dog')!.getAttribute('aria-selected')).toBe('true');
  // A press of the selected item closes the list with no change.
  pressWith(find('.dog')!);
  await page.waitFor(() => expect(find('.list')).toBeNull());
  expect(state(page)[1]).toEqual(['dog']);
});

it('skips disabled items, and closes on Escape and Tab with no change', async () => {
  const page = await selects();
  const trigger = page.get('.trigger');
  trigger.focus();
  press('ArrowDown', trigger);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cat')));
  press('End');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.dog')));
  press('Escape');
  await page.waitFor(() => expect(find('.list')).toBeNull());
  expect(document.activeElement).toBe(trigger);
  press('ArrowUp', trigger);
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cat')));
  press('Tab');
  await page.waitFor(() => expect(find('.list')).toBeNull());
  expect(state(page)[0]).toBe(null);
});

it('shows the message of the browser when a required Select is empty on a submit', async () => {
  const page = await selects();
  const form = page.get('.form') as HTMLFormElement;
  expect(form.checkValidity()).toBe(false);
  form.reportValidity();
  await page.waitFor(() => expect(find('.animal-error')).not.toBeNull());
  expect(page.get('.animal').hasAttribute('data-invalid')).toBe(true);
  expect(page.get('.trigger').getAttribute('aria-describedby')).toContain(
    page.get('.animal-error').id,
  );
  // A selection makes it valid, and the message goes. happy-dom does not match `:invalid`, so
  // the e2e test checks that focus moves to the Button.
  page.get('.trigger').focus();
  press('ArrowDown', page.get('.trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.cat')));
  press('Enter');
  await page.waitFor(() => expect(find('.animal-error')).toBeNull());
  expect(form.checkValidity()).toBe(true);
});

it('names a selection that it starts with by its template, and keys stay numbers', async () => {
  const page = await selects();
  expect(page.text('.size-value')).toBe('Medium');
  pressWith(page.get('.size-trigger'));
  await page.waitFor(() => expect(document.activeElement).toBe(find('.size-2')));
  press('ArrowDown');
  await page.waitFor(() => expect(document.activeElement).toBe(find('.size-3')));
  press(' ');
  await page.waitFor(() => expect(find('.size-list')).toBeNull());
  await page.waitFor(() => expect(page.text('.size-value')).toBe('Large'));
  expect(state(page)[2]).toBe(3);
});
