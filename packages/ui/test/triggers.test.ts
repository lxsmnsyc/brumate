// The triggers of $client and #client in a test: brumate/testing reports elements as visible.
import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Triggers from './fixtures/triggers.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
});

it('runs visible and idle triggers', async () => {
  const page = await mount(Triggers, {});
  unmount = page.unmount;
  await page.waitFor(() => expect(page.text('.seen')).toBe('visible'));
  await page.waitFor(() => expect(page.text('.idled')).toBe('idle'));
  await page.waitFor(() => expect(page.get('.block')).toBeTruthy());
});

it('keeps an element out of view until it is revealed', async () => {
  const page = await mount(Triggers, {}, { offscreen: '.seen' });
  unmount = page.unmount;
  await page.waitFor(() => expect(page.text('.idled')).toBe('idle'));
  await new Promise((done) => setTimeout(done, 50));
  expect(page.text('.seen')).toBe('waiting');
  page.reveal('.seen');
  await page.waitFor(() => expect(page.text('.seen')).toBe('visible'));
});

it('puts the observer of the environment back on unmount', async () => {
  const before = globalThis.IntersectionObserver;
  const page = await mount(Triggers, {});
  expect(globalThis.IntersectionObserver).not.toBe(before);
  page.unmount();
  expect(globalThis.IntersectionObserver).toBe(before);
});
