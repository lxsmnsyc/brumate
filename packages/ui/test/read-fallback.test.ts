// The two forms of an optional store on one reader each: a store as the fallback (Toolbar's
// locale) and the guard on the value (Label), and `$getContext(ToolbarContext, false)`.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import ReadFallback from './fixtures/readFallback.brm?brumate-server';
import { press } from './interact.ts';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

async function readers() {
  const page = await mount(ReadFallback, {});
  unmount = page.unmount;
  return page;
}

it('renders a Label with and without the store of its context', async () => {
  const page = await readers();
  const alone = page.get('.alone');
  expect(alone.tagName).toBe('LABEL');
  expect(alone.hasAttribute('id')).toBe(false);
  const given = page.get('.given');
  expect(given.getAttribute('id')).toBe('given-id');
  expect(given.getAttribute('for')).toBe('given-input');
});

it('reads the locale of a provider, or the default without one', async () => {
  const page = await readers();
  // Without a provider the arrow keys follow en-US, left to right.
  const a = page.get('.a') as HTMLElement;
  a.focus();
  press('ArrowRight', a);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.b')));
  // With the provider's Arabic locale they turn around.
  const c = page.get('.c') as HTMLElement;
  c.focus();
  press('ArrowLeft', c);
  await page.waitFor(() => expect(document.activeElement).toBe(page.get('.d')));
});

it('is a group inside another toolbar, and a toolbar alone', async () => {
  const page = await readers();
  expect(page.get('.outer').getAttribute('role')).toBe('toolbar');
  expect(page.get('.inner').getAttribute('role')).toBe('group');
  expect(page.get('.ltr').getAttribute('role')).toBe('toolbar');
});
