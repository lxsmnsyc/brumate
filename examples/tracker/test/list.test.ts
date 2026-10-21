import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getEvent, handleRequest } from 'brumate/server';
import { functions as stubs } from 'virtual:brumate/server';
import { mount } from 'virtual:brumate/testing';
import Index from '../src/routes/index.brm?brumate-server';
import { allIssues, changeIssue, findIssue, resetStore } from '../src/store.ts';

// The list page renders on the server and resumes in happy-dom. In this DOM
// environment, src/issues.ts is the stubs that the browser gets, so the test
// answers their calls with functions of its own, on the same store.
// test/server.test.ts runs the real ones.
const idOf = (name: string) => Object.keys(stubs).find((id) => id.endsWith(`#${name}`))!;

async function listIssues() {
  return allIssues();
}

const functions = {
  [idOf('listIssues')]: listIssues,
  [idOf('toggleStar')]: async (id: number) => {
    const event = getEvent();
    changeIssue(id, { starred: !findIssue(id)!.starred });
    event.refresh(listIssues);
  },
};

let calls: string[] = [];

beforeEach(() => {
  resetStore();
  calls = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(String(input), 'http://localhost'), init);
    calls.push(decodeURIComponent(new URL(request.url).pathname).split('#')[1]!);
    return (await handleRequest(functions, request))!;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = () => new Request('http://localhost/');
const titles = (page: { container: HTMLElement }) =>
  [...page.container.querySelectorAll('.issues li a')].map((link) => link.textContent);

it('filters the list as the user types and picks a status', async () => {
  const page = await mount(Index, {}, { request: request() });
  expect(titles(page)).toEqual([
    'Document the keyboard shortcuts',
    'Add a dark theme',
    'Search ignores closed issues',
  ]);
  page.input('input[type=search]', 'theme');
  await page.waitFor(() => expect(titles(page)).toEqual(['Add a dark theme']));

  page.input('input[type=search]', '');
  const status = page.get('select') as HTMLSelectElement;
  status.value = 'closed';
  status.dispatchEvent(new Event('change', { bubbles: true }));
  await page.waitFor(() => expect(titles(page)).toEqual(['Links break on phones']));
  page.unmount();
});

it('stars an issue, then loads the list again', async () => {
  const page = await mount(Index, {}, { request: request() });
  const star = () => page.get('button[aria-label="Star #2"]');
  expect(star().getAttribute('aria-pressed')).toBe('false');
  calls = [];
  page.click('button[aria-label="Star #2"]');
  await page.waitFor(() => expect(star().textContent).toBe('★'));
  // The star call refreshes the list, so the memo loads it again.
  await page.waitFor(() => expect(calls.slice(0, 2)).toEqual(['toggleStar', 'listIssues']));
  expect(star().getAttribute('aria-pressed')).toBe('true');
  page.unmount();
});
