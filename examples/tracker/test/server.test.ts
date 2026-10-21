// @vitest-environment node
import { RequestEvent, ServerError, fieldErrors, parseForm, withEvent } from 'brumate/server';
import { beforeEach, expect, it } from 'vitest';
import { getIssue, toggleStar } from '../src/issues.ts';
import { NewIssue } from '../src/schema.ts';
import { resetStore } from '../src/store.ts';

// Server functions are plain functions on the server. `withEvent` gives them the
// event of a request, as the server does for a call from the browser.
const event = () => new RequestEvent(new Request('http://localhost/'));

beforeEach(() => {
  resetStore();
});

it('stars an issue, and asks the page to load the list again', async () => {
  const call = event();
  await withEvent(call, () => toggleStar(2));
  expect((await getIssue(2)).starred).toBe(true);
  expect(call.refreshed?.size).toBe(1);
});

it('checks the ID that a handler sends', async () => {
  const bad = withEvent(event(), () => toggleStar('2; drop table'));
  await expect(bad).rejects.toThrow('Not an issue ID');
  await expect(bad).rejects.toMatchObject({ status: 400 });
});

it('answers 404 for an issue that is not there', async () => {
  const missing = getIssue(99);
  await expect(missing).rejects.toBeInstanceOf(ServerError);
  await expect(missing).rejects.toMatchObject({ status: 404, message: 'There is no issue #99' });
});

it('validates the new issue form', async () => {
  const form = new FormData();
  form.set('title', 'No');
  form.append('labels[]', 'bug');
  form.append('labels[]', 'urgent');
  const result = await parseForm(NewIssue, form);
  expect(result.issues && fieldErrors(result.issues)).toEqual({
    title: ['Write a title of at least 3 characters'],
    labels: ['Pick labels from the list'],
  });

  form.set('title', '  Export as CSV ');
  form.delete('labels[]');
  form.append('labels[]', 'feature');
  expect(await parseForm(NewIssue, form)).toEqual({
    value: { title: 'Export as CSV', body: '', labels: ['feature'] },
  });
});
