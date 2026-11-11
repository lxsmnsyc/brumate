import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'brumate/server';
import { mount } from 'virtual:brumate/testing';
import {
  colorSchemeCookie,
  parseColorScheme,
  readColorScheme,
  resolveColorScheme,
} from '../src/color-scheme.ts';
import Bound from './fixtures/ColorSchemeBound.brm?brumate-server';
import Html from './fixtures/ColorSchemeHtml.brm?brumate-server';
import HtmlNoScript from './fixtures/ColorSchemeHtmlNoScript.brm?brumate-server';
import Plain from './fixtures/ColorSchemePlain.brm?brumate-server';

let unmount: (() => void) | undefined;
let listeners: ((event: { matches: boolean }) => void)[] = [];
let dark = false;

// A stub of matchMedia that tests change by hand.
beforeEach(() => {
  listeners = [];
  dark = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return dark;
    },
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
      listeners.push(listener);
    },
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  unmount?.();
  document.cookie = 'theme=; Max-Age=0; Path=/';
  vi.unstubAllGlobals();
});

function request(cookie?: string) {
  const made = new Request('http://localhost/');
  // Set after the request is made, since a DOM environment drops the cookie header from its init.
  if (cookie) {
    made.headers.set('cookie', cookie);
  }
  return made;
}

function classes(element: Element) {
  return [...element.classList].toSorted();
}

it('renders the class of the cookie on the server, with no author signal', async () => {
  const page = await mount(Plain, {}, { request: request('theme=dark') });
  unmount = page.unmount;
  const root = page.get('[data-color-scheme]');
  expect(classes(root)).toEqual(['app', 'dark']);
  expect(root.getAttribute('data-color-scheme')).toBe('dark');
  expect(root.style.colorScheme).toBe('dark');
  expect(page.text('#seen')).toBe('dark dark');
});

it('writes no cookie on the first load', async () => {
  const page = await mount(Plain, {}, { request: request('theme=dark') });
  unmount = page.unmount;
  expect(document.cookie).not.toContain('theme');
});

it('has no class of its own for system, and no empty class', async () => {
  const page = await mount(Plain, {}, { request: request('theme=blue') });
  unmount = page.unmount;
  const root = page.get('[data-color-scheme]');
  expect(root.getAttribute('data-color-scheme')).toBe('system');
  expect(root.getAttribute('class')).toBe('app');
  expect(root.style.colorScheme).toBe('light dark');
});

it('changes the choice with colorScheme() in a descendant, and writes the cookie', async () => {
  const page = await mount(Plain, {}, { request: request('theme=light') });
  unmount = page.unmount;
  const root = page.get('[data-color-scheme]');
  page.click('#dark');
  await page.waitFor(() => expect(classes(root)).toEqual(['app', 'dark']));
  expect(document.cookie).toContain('theme=dark');
  expect(page.text('#seen')).toBe('dark dark');
});

it('follows the preference of the device for system, and its changes', async () => {
  const page = await mount(Plain, {}, { request: request('theme=dark') });
  unmount = page.unmount;
  const root = page.get('[data-color-scheme]');
  page.click('#system');
  await page.waitFor(() => expect(classes(root)).toEqual(['app', 'light']));
  expect(document.cookie).toContain('theme=system');
  expect(root.style.colorScheme).toBe('light');
  // The device switches to dark.
  dark = true;
  for (const listener of listeners) {
    listener({ matches: true });
  }
  await page.waitFor(() => expect(classes(root)).toEqual(['app', 'dark']));
  expect(root.style.colorScheme).toBe('dark');
});

it('takes the dark preference when the choice goes from light to system', async () => {
  dark = true;
  const page = await mount(Plain, {}, { request: request('theme=light') });
  unmount = page.unmount;
  const root = page.get('[data-color-scheme]');
  expect(classes(root)).toEqual(['app', 'light']);
  page.click('#system');
  await page.waitFor(() => expect(classes(root)).toEqual(['app', 'dark']));
  expect(root.style.colorScheme).toBe('dark');
});

it('reads the cookie for an undefined bound value, and writes the bound signal', async () => {
  const page = await mount(Bound, {}, { request: request('theme=dark') });
  unmount = page.unmount;
  const root = page.get('[data-color-scheme]');
  expect(classes(root)).toEqual(['app', 'dark']);
  expect(page.text('#signal')).toBe('none');
  // A write from outside changes the class.
  page.click('#outside');
  await page.waitFor(() => expect(classes(root)).toEqual(['app', 'light']));
  expect(document.cookie).toContain('theme=light');
  // A write from inside goes to the signal.
  page.click('#dark');
  await page.waitFor(() => expect(page.text('#signal')).toBe('dark'));
  expect(classes(root)).toEqual(['app', 'dark']);
});

it('renders the class and the style on <html>, with a head script only for system', async () => {
  const chosen = await render(Html, {}, { request: request('theme=dark') });
  expect(chosen.html).toMatch(
    /<html[^>]*class="dark"[^>]*lang="en"|<html[^>]*lang="en"[^>]*class="dark"/,
  );
  expect(chosen.html).toContain('color-scheme: dark');
  expect(chosen.head).not.toContain('matchMedia');

  const system = await render(Html, {}, { request: request(), nonce: 'render1' });
  expect(system.html).toMatch(/<html[^>]*data-color-scheme="system"/);
  expect(system.html).toContain('color-scheme: light dark');
  // The script goes to the head, with the nonce.
  expect(system.head).toMatch(
    /<script nonce="render1">\(function\(\)\{var d=document\.documentElement/,
  );

  const without = await render(HtmlNoScript, {}, { request: request() });
  expect(without.head).not.toContain('matchMedia');
});

it('has helpers for the cookie and the preference', () => {
  expect(parseColorScheme('dark')).toBe('dark');
  expect(parseColorScheme(undefined)).toBe('system');
  expect(parseColorScheme('purple')).toBe('system');
  expect(readColorScheme({ getCookie: () => 'light' })).toBe('light');
  expect(colorSchemeCookie('theme', 'dark')).toBe(
    'theme=dark; Max-Age=31536000; Path=/; SameSite=Lax',
  );
  expect(colorSchemeCookie('theme', 'dark', true)).toContain('; Secure');
  expect(resolveColorScheme('system', true)).toBe('dark');
  expect(resolveColorScheme('system', false)).toBe('light');
  expect(resolveColorScheme('light', true)).toBe('light');
});
