import { afterEach, expect, it } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import { isRTL, localeOf } from '../src/locale.ts';
import Locales from './fixtures/locales.brm?brumate-server';

let unmount: (() => void) | undefined;
afterEach(() => unmount?.());

it('gives the parts inside it a locale and its direction, and en-US outside', async () => {
  const page = await mount(Locales, {});
  unmount = page.unmount;
  expect(page.text('.default')).toBe('en-US ltr');
  expect(page.text('.arabic')).toBe('ar-EG rtl');
  // The nearest provider wins.
  expect(page.text('.french')).toBe('fr-FR ltr');
});

it('tells the direction of a locale by its script, as React Aria does', () => {
  expect(isRTL('he')).toBe(true);
  expect(isRTL('fa-IR')).toBe(true);
  // Uzbek in Arabic script is right to left, and in Latin script is not.
  expect(isRTL('uz-Arab')).toBe(true);
  expect(isRTL('uz-Latn')).toBe(false);
  expect(localeOf('ja-JP')).toEqual({ locale: 'ja-JP', direction: 'ltr' });
});

it('renders a shortcut left to right, with the attributes of the caller', async () => {
  const page = await mount(Locales, {});
  unmount = page.unmount;
  const key = page.get('kbd');
  expect(key.getAttribute('dir')).toBe('ltr');
  expect(key.getAttribute('title')).toBe('Paste');
  expect(key.textContent).toBe('⌘V');
});
