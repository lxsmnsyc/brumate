// Run by test/testing-a11y.test.ts, in happy-dom.
import { afterEach, expect, it } from 'vitest';
import { createVisit } from 'brumate/testing';
import type { Visited } from 'brumate/testing';

const pages: Record<string, string> = {
  '/plain': '<p>Hello</p>',
  '/inert': '<p inert>Hello</p>',
};

const visit = createVisit({
  load: () => Promise.reject(new Error('No client code')),
  routes: async () => async (request) => {
    const body = pages[new URL(request.url).pathname];
    if (body === undefined) {
      return undefined;
    }
    return new Response(
      `<!doctype html><html lang="en"><head><title>Page</title></head><body>${body}</body></html>`,
      { headers: { 'content-type': 'text/html' } },
    );
  },
  calls: async () => async () => undefined,
});

let page: Visited | undefined;

afterEach(() => {
  page?.close();
});

it('checks the rules about the whole page for a visit', async () => {
  page = await visit('/plain');
  const error = await page.checkAccessibility().then(
    () => undefined,
    (thrown: Error) => thrown,
  );
  expect(error?.message).toMatch(/landmark-one-main|region/);
});

it('turns the landmark rules off while the page has an inert element', async () => {
  page = await visit('/inert');
  await expect(page.checkAccessibility()).resolves.toBeUndefined();
});
