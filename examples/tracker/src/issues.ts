'use server';

// A file of server functions. Each export runs only on the server, and the
// browser gets a stub that calls it. The store and the session never ship.

import { ServerError, getEvent, parse } from 'brumate/server';
import { IssueId } from './schema.ts';
import { session } from './session.ts';
import { allIssues, changeIssue, findIssue, recentActivity } from './store.ts';
import type { Activity, Issue } from './store.ts';

export async function listIssues(): Promise<Issue[]> {
  return allIssues();
}

/** One issue. The ID comes from the URL or a handler, so it can be any text. */
export async function getIssue(id: unknown): Promise<Issue> {
  const issue = findIssue(Number(id));
  if (!issue) {
    // The nearest _error.brm shows it, with this status.
    throw new ServerError(`There is no issue #${String(id)}`, { status: 404 });
  }
  return issue;
}

/** Stars an issue or takes its star away. A handler calls it, so the ID is checked. */
export async function toggleStar(input: unknown): Promise<void> {
  // Before the first await, which `parse` is.
  const event = getEvent();
  const id = await parse(IssueId, input);
  const issue = findIssue(id);
  if (!issue) {
    throw new ServerError(`There is no issue #${id}`, { status: 404 });
  }
  changeIssue(id, { starred: !issue.starred });
  // Memos that call listIssues load again.
  event.refresh(listIssues);
}

/** The activity feed. It is slow on purpose, so the page streams it in. */
export async function listActivity(): Promise<Activity[]> {
  await new Promise((done) => setTimeout(done, 600));
  return recentActivity();
}

/** The name of the user who is signed in, or undefined. */
export async function currentUser(): Promise<string | undefined> {
  const event = getEvent();
  return (await session.get(event))?.name;
}
