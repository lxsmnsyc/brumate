// The tests of Fieldset and Legend, and of the disabled state that a Fieldset or a Form gives down.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Fieldsets from './fixtures/fieldsets.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

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
