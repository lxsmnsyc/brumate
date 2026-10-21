import { beforeEach, expect, it } from 'vitest';
import { answerCalls, mount } from 'virtual:brumate/testing';
import Index from '../src/routes/index.brm?brumate-server';
import { resetStore } from '../src/store.ts';

// The list page renders on the server and resumes in happy-dom. `answerCalls`
// answers the calls of the page with the server code of src/issues.ts, which
// changes the same store as the test. The function that it returns restores
// `fetch`, and Vitest calls it after each test.
let calls: string[] = [];

beforeEach(() => {
  resetStore();
  calls = [];
  return answerCalls({ onCall: (id) => calls.push(id.split('#')[1]!) });
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
