// An open overlay in an #offscreen body: hiding releases the page, showing puts the overlay back.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Fixture from './fixtures/overlay-offscreen.brm?brumate-server';
import { pointer, pressWith } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  for (const layer of document.querySelectorAll('[data-layer]')) {
    layer.remove();
  }
  for (const element of document.querySelectorAll('[inert]')) {
    element.removeAttribute('inert');
  }
  document.documentElement.removeAttribute('style');
});

const find = (selector: string) => document.querySelector<HTMLElement>(selector);
const visibleNow = (selector: string) => {
  const element = find(selector);
  return Boolean(element && element.checkVisibility());
};

async function page() {
  const mounted = await mount(Fixture, {});
  unmount = mounted.unmount;
  return mounted;
}

it.each([
  ['modal-trigger', 'overlay', 'modal-dialog', true],
  ['popover-trigger', 'popover', 'popover-dialog', true],
])(
  '%s: releases the page while hidden, and opens again when shown',
  async (trigger, part, dialog, locks) => {
    const mounted = await page();
    pressWith(mounted.get(`.${trigger}`));
    await mounted.waitFor(() => expect(visibleNow(`.${part}`)).toBe(true));
    await mounted.waitFor(() => expect(find('[data-layer]')).not.toBeNull());
    expect(Boolean(locks) && document.documentElement.style.overflow).toBe('hidden');
    mounted.get('.toggle').click();
    await mounted.waitFor(() => expect(visibleNow(`.${part}`)).toBe(false));
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    // Focus went back to the trigger when the overlay released the page.
    expect(document.activeElement).toBe(mounted.get(`.${trigger}`));
    mounted.get('.toggle').click();
    await mounted.waitFor(() => expect(visibleNow(`.${part}`)).toBe(true));
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(mounted.get('.page').closest('[inert]')).not.toBeNull();
    await mounted.waitFor(() => expect(document.activeElement).toBe(find(`.${dialog}`)));
    expect(mounted.get(`.${trigger}`).getAttribute('aria-expanded')).toBe('true');
  },
);

it('tip-trigger: hides with the body and shows again', async () => {
  const mounted = await page();
  pointer('pointerenter', mounted.get('.tip-trigger'));
  await mounted.waitFor(() => expect(visibleNow('.tip')).toBe(true));
  mounted.get('.toggle').click();
  await mounted.waitFor(() => expect(visibleNow('.tip')).toBe(false));
  mounted.get('.toggle').click();
  await mounted.waitFor(() => expect(visibleNow('.tip')).toBe(true));
});
