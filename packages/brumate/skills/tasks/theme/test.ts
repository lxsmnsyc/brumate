import { expect, it, vi } from 'vitest';
import { mount } from 'virtual:brumate/testing';
import Theme from './src/Theme.brm?brumate-server';

// The cookie header is set after the request is made, since a DOM environment drops it from the init.
function request(cookie: string) {
  const made = new Request('http://localhost/');
  made.headers.set('cookie', cookie);
  return made;
}

it('renders the class of the cookie, and a click changes it and the cookie', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const page = await mount(Theme, {}, { request: request('theme=light') });
  const root = page.get('[data-color-scheme]');
  expect(root.classList.contains('app')).toBe(true);
  expect(root.classList.contains('light')).toBe(true);
  expect(page.text('.toggle')).toBe('Scheme: light');

  page.click('.toggle');
  await page.waitFor(() => expect(root.classList.contains('dark')).toBe(true));
  expect(root.classList.contains('light')).toBe(false);
  expect(page.text('.toggle')).toBe('Scheme: dark');
  expect(document.cookie).toContain('theme=dark');

  page.unmount();
  document.cookie = 'theme=; Max-Age=0; Path=/';
  vi.unstubAllGlobals();
});
