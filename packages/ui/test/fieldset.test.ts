// The tests of Fieldset and Legend, and of the disabled state that a Fieldset or a Form gives down.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import { press, pressWith } from './interact.ts';
import Fieldsets from './fixtures/fieldsets.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  // A portal renders outside the mounted container.
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
});

async function fieldsets() {
  const page = await mount(Fieldsets, {});
  unmount = page.unmount;
  return page;
}

type Page = Awaited<ReturnType<typeof fieldsets>>;

/** The names that a form would post. */
function posted(page: Page, selector: string): string[] {
  const form = page.get(selector) as HTMLFormElement;
  return [...new FormData(form).keys()];
}

it('renders a fieldset with a legend', async () => {
  const page = await fieldsets();
  const locked = page.get('.locked') as HTMLFieldSetElement;
  expect(locked.tagName).toBe('FIELDSET');
  expect(locked.querySelector('legend')?.textContent).toBe('Locked');
  expect(locked.disabled).toBe(true);
  expect(locked.hasAttribute('data-disabled')).toBe(true);
  expect((page.get('.open') as HTMLFieldSetElement).disabled).toBe(false);
});

it('disables the fields in a disabled fieldset, and posts nothing from them', async () => {
  const page = await fieldsets();
  expect((page.get('.name-input') as HTMLInputElement).disabled).toBe(true);
  expect((page.get('.age-input') as HTMLInputElement).disabled).toBe(true);
  expect((page.get('.locked-button') as HTMLButtonElement).disabled).toBe(true);
  expect(page.get('.locked [name="news"]').matches(':disabled')).toBe(true);
  expect(page.get('.locked [name="dark"]').matches(':disabled')).toBe(true);
  expect(page.get('.locked [name="volume"]').matches(':disabled')).toBe(true);
  expect(posted(page, '.form')).toEqual(['city']);
});

it('disables a fieldset inside a disabled one', async () => {
  const page = await fieldsets();
  expect(page.get('.inner').hasAttribute('data-disabled')).toBe(true);
  expect((page.get('.nick-input') as HTMLInputElement).disabled).toBe(true);
});

it('leaves a fieldset without isDisabled alone', async () => {
  const page = await fieldsets();
  expect((page.get('.city-input') as HTMLInputElement).disabled).toBe(false);
  expect((page.get('.open-button') as HTMLButtonElement).disabled).toBe(false);
});

it('enables the fields when the fieldset is enabled', async () => {
  const page = await fieldsets();
  (page.get('.toggle') as HTMLButtonElement).click();
  await page.waitFor(() => expect(posted(page, '.form')).toContain('name'));
  expect(posted(page, '.form')).toEqual(
    expect.arrayContaining(['name', 'age', 'news', 'dark', 'volume', 'nick', 'city']),
  );
  expect((page.get('.locked-button') as HTMLButtonElement).disabled).toBe(false);
  expect(page.get('.locked').hasAttribute('data-disabled')).toBe(false);
});

it('disables the fields of a disabled form', async () => {
  const page = await fieldsets();
  expect((page.get('.solo-input') as HTMLInputElement).disabled).toBe(true);
  expect((page.get('.solo-button') as HTMLButtonElement).disabled).toBe(true);
  expect(posted(page, '.off-form')).toEqual([]);
});

const find = (selector: string) => document.querySelector<HTMLElement>(selector);

function counts(page: Page) {
  return page.text('.counts');
}

it('shows a disabled fieldset on the groups, and ignores a press on their items', async () => {
  const page = await fieldsets();
  for (const group of ['.tabs', '.table', '.check-group', '.radio-group', '.toggle-group']) {
    expect(page.get(group).hasAttribute('data-disabled')).toBe(true);
  }
  for (const group of ['.table', '.radio-group', '.toggle-group']) {
    expect(page.get(group).getAttribute('aria-disabled')).toBe('true');
  }
  // A press on a tab, a row, a box, a radio and a toggle does nothing.
  pressWith(page.get('.tab-two'));
  pressWith(page.get('.row-notes'));
  press('Enter', page.get('.row-photo'));
  (page.get('.check-a') as HTMLElement).click();
  (page.get('.radio-s') as HTMLElement).click();
  pressWith(page.get('.toggle-bold'));
  await new Promise((done) => setTimeout(done, 20));
  expect(counts(page)).toBe('0|0|one|||');
  for (const item of ['.tab-one', '.tab-two', '.row-notes', '.row-photo', '.toggle-bold']) {
    expect(
      page.get(item).getAttribute('aria-disabled') ?? page.get(item).hasAttribute('disabled'),
    ).toBeTruthy();
    expect(page.get(item).hasAttribute('data-disabled')).toBe(true);
  }
});

it('disables the items of an open menu', async () => {
  const page = await fieldsets();
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  expect(find('.menu')!.hasAttribute('data-disabled')).toBe(true);
  for (const item of ['.menu-copy', '.menu-cut']) {
    expect(find(item)!.getAttribute('aria-disabled')).toBe('true');
    expect(find(item)!.hasAttribute('data-disabled')).toBe(true);
  }
  pressWith(find('.menu-copy')!);
  press('Enter', find('.menu-cut')!);
  await new Promise((done) => setTimeout(done, 20));
  expect(counts(page).startsWith('0|')).toBe(true);
});

it('enables the groups and their items with the fieldset', async () => {
  const page = await fieldsets();
  await page.waitFor(() => expect(find('.menu')).not.toBeNull());
  expect((page.get('.menu-trigger') as HTMLButtonElement).disabled).toBe(true);
  (page.get('.toggle') as HTMLButtonElement).click();
  await page.waitFor(() => expect(page.get('.tabs').hasAttribute('data-disabled')).toBe(false));
  for (const group of ['.table', '.check-group', '.radio-group', '.toggle-group']) {
    expect(page.get(group).hasAttribute('data-disabled')).toBe(false);
    expect(page.get(group).hasAttribute('aria-disabled')).toBe(false);
  }
  expect((page.get('.menu-trigger') as HTMLButtonElement).disabled).toBe(false);
  expect(page.get('.tab-two').hasAttribute('aria-disabled')).toBe(false);
  expect(page.get('.row-notes').hasAttribute('aria-disabled')).toBe(false);
  // The items work again.
  pressWith(page.get('.tab-two'));
  pressWith(page.get('.toggle-bold'));
  (page.get('.radio-s') as HTMLElement).click();
  (page.get('.check-a') as HTMLElement).click();
  await page.waitFor(() => expect(counts(page)).toBe('0|0|two|bold|s|a'));
  // The menu is closed by the press outside. It opens again with its items enabled.
  if (!find('.menu')) {
    pressWith(page.get('.menu-trigger'));
  }
  await page.waitFor(() => expect(find('.menu-copy')).not.toBeNull());
  expect(find('.menu')!.hasAttribute('data-disabled')).toBe(false);
  expect(find('.menu-copy')!.hasAttribute('aria-disabled')).toBe(false);
  pressWith(find('.menu-copy')!);
  await page.waitFor(() => expect(counts(page).startsWith('1|')).toBe(true));
});
