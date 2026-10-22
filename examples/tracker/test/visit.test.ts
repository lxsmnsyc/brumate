import { afterEach, beforeEach, expect, it } from 'vitest';
import { visit } from 'virtual:brumate/testing';
import { resetStore } from '../src/store.ts';

// `visit` answers a path with the routes of the app and resumes the page in
// happy-dom. Links, forms and calls of the page go to the same routes, with
// the cookies that the answers set, so a test can sign in and go on.
let page: Awaited<ReturnType<typeof visit>> | undefined;

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  page?.close();
});

it('follows a link with client navigation', async () => {
  page = await visit('/');
  expect(page.status).toBe(200);
  expect(page.text('h1')).toBe('Issues');
  page.click('a[href="/issues/3"]');
  await page.waitFor(() => expect(page!.url).toBe('/issues/3'));
  await page.waitFor(() => expect(page!.text('h1')).toContain('Document the keyboard shortcuts'));
});

it('signs in through the form, and keeps the cookie for the next page', async () => {
  page = await visit('/issues/new');
  // The middleware sends a visitor who is not signed in to the sign-in page.
  expect(page.url).toBe('/sign-in?next=%2Fissues%2Fnew');
  page.input('input[name=name]', 'Ada');
  page.submit('form');
  await page.waitFor(() => expect(page!.url).toBe('/issues/new'));
  expect(Object.keys(page.cookies)).not.toEqual([]);
  expect(page.text('header .user span')).toBe('Ada');
});

it('starts signed in with the cookies of the options', async () => {
  page = await visit('/sign-in');
  page.input('input[name=name]', 'Grace');
  page.submit('form');
  await page.waitFor(() => expect(page!.url).toBe('/'));
  const { cookies } = page;
  page.close();
  page = await visit('/issues/new', { cookies });
  expect(page.url).toBe('/issues/new');
  expect(page.text('header .user span')).toBe('Grace');
});

it('streams #loading bodies, and asks for #defer bodies with the cookies', async () => {
  page = await visit('/sign-in');
  page.input('input[name=name]', 'Ada');
  page.submit('form');
  await page.waitFor(() => expect(page!.url).toBe('/'));
  // The activity of the aside streams in after the page.
  await page.waitFor(() => expect(page!.text('.feed')).toContain('Edsger closed #4'));
  page.click('a[href="/about"]');
  await page.waitFor(() => expect(page!.text('.who')).toBe('You are signed in as Ada.'));
});
