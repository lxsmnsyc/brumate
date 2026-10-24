import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Toggles from './fixtures/toggles.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

it('keeps its own copy of a value, and writes a bound one to the caller', async () => {
  const page = await mount(Toggles, {});
  unmount = page.unmount;
  const state = (label: string) => page.get(`.toggle.${label}`).getAttribute('aria-pressed');
  const changes = () => page.text('.changes').trim();
  // No value: the part starts at its default and keeps its own state.
  expect(state('own')).toBe('false');
  page.click('.toggle.own');
  await page.waitFor(() => expect(state('own')).toBe('true'));
  await page.waitFor(() => expect(changes()).toBe('own:true'));
  // A value starts the part's own copy, and a new value from the caller replaces it.
  expect(state('start')).toBe('true');
  page.click('.toggle.start');
  await page.waitFor(() => expect(state('start')).toBe('false'));
  page.click('.reset');
  await page.waitFor(() => expect(state('start')).toBe('false'));
  page.click('.reset');
  await page.waitFor(() => expect(state('start')).toBe('true'));
  // A bound value: the part writes the caller's signal.
  page.click('.toggle.bound');
  await page.waitFor(() => expect(page.text('.values')).toBe('true false'));
  expect(state('bound')).toBe('true');
  // A binding with a setter that keeps the value: the part reports, and shows what the caller keeps.
  page.click('.toggle.locked');
  await page.waitFor(() => expect(changes()).toBe('own:true locked:true'));
  expect(state('locked')).toBe('false');
  expect(page.text('.values')).toBe('true false');
});
