import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { visit } from 'virtual:brumate/testing';
import { clean, useFixtures } from '../src/hn.ts';
import { fixtures } from './fixtures.ts';

// The pages read the fixtures in place of the API.
let page: Awaited<ReturnType<typeof visit>> | undefined;

beforeAll(() => useFixtures(fixtures));
afterAll(() => useFixtures(undefined));
afterEach(() => page?.close());

const titles = (): string[] =>
  [...document.querySelectorAll('.story .title')].map((link) => link.textContent ?? '');

it('lists the top stories, with a link to the page of an Ask HN', async () => {
  page = await visit('/');
  expect(page.status).toBe(200);
  expect(titles()).toEqual(['A compiler that ships less code', 'Ask HN: What do you resume?']);
  expect(page.get('.story:nth-child(2) .title').getAttribute('href')).toBe('/item/2');
  expect(page.text('.where')).toBe('Page 1 of 10');
});

it('goes to the next page and to the new stories', async () => {
  page = await visit('/?page=2');
  expect(titles()).toEqual(['The second page']);
  expect(page.get('.stories').getAttribute('start')).toBe('31');
  page.close();
  page = await visit('/new');
  expect(titles()).toEqual(['Just posted']);
  expect(page.text('.story .comments')).toBe('discuss');
});

it('shows a story with its comments, and folds a thread', async () => {
  page = await visit('/item/1');
  expect(page.text('h1')).toBe('A compiler that ships less code');
  expect(page.text('.comments h2')).toBe('2 comments');
  // The HTML of a comment keeps its text and drops a script.
  expect(page.get('.comment .text').innerHTML).toBe('<p>Nice <i>work</i>.alert(1)</p>');
  page.click('.fold');
  await page.waitFor(() => expect(page!.text('.fold')).toBe('+2'));
  expect((page.get('.comment .thread') as HTMLElement).hidden).toBe(true);
});

it('shows a user, and a missing story with 404', async () => {
  page = await visit('/user/ada');
  expect(page.text('h1')).toBe('ada');
  expect(page.text('.facts')).toContain('12,345');
  page.close();
  page = await visit('/item/999');
  expect(page.status).toBe(404);
  expect(page.text('h1')).toBe('No story with the ID 999');
});

it('keeps only safe tags and links', () => {
  expect(clean('<p onclick="x">Hi <a href="javascript:alert(1)">link</a> <img src=x></p>')).toBe(
    '<p>Hi <a>link</a> </p>',
  );
  expect(clean('<a href="https://example.com" onmouseover="x">ok</a>')).toBe(
    '<a href="https://example.com" rel="nofollow noreferrer">ok</a>',
  );
});
