// A ref bound on Link, Button or Heading gives back its element, also with a component in `as`.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import RefForward from './fixtures/refForward.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

it('gives back the element of Link, Button and Heading', async () => {
  const page = await mount(RefForward, {});
  unmount = page.unmount;
  page.click('.probe');
  await page.waitFor(() => expect(page.text('.plain')).toBe('A BUTTON H3'));
});

it('gives back the component in `as` of Link, Button and Heading', async () => {
  const page = await mount(RefForward, {});
  unmount = page.unmount;
  page.click('.probe');
  await page.waitFor(() => expect(page.text('.targeted')).toBe('target target target'));
});
