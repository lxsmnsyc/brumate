// The issues, kept in memory for the example. A real app would use a database.
// Only server code imports this file, so it never ships to the browser.

export interface Issue {
  id: number;
  title: string;
  body: string;
  author: string;
  labels: string[];
  open: boolean;
  starred: boolean;
  /** Other issues that this one refers to. Some of them can be deleted. */
  related: number[];
  created: string;
}

export interface Activity {
  id: number;
  text: string;
  at: string;
}

let issues: Issue[] = [];
let activity: Activity[] = [];
let nextId = 1;
let nextEvent = 1;

function seedIssue(issue: Omit<Issue, 'id' | 'created' | 'related'> & { related?: number[] }) {
  issues.push({
    related: [],
    ...issue,
    id: nextId++,
    created: new Date(2026, 9, nextId).toISOString(),
  });
}

/** Puts the store back to its first issues. The tests call it before each test. */
export function resetStore(): void {
  issues = [];
  activity = [];
  nextId = 1;
  nextEvent = 1;
  seedIssue({
    title: 'Search ignores closed issues',
    body: 'Searching for a word only finds open issues.',
    author: 'Ada',
    labels: ['bug'],
    open: true,
    starred: true,
  });
  seedIssue({
    title: 'Add a dark theme',
    body: 'The tracker should follow the theme of the system.',
    author: 'Grace',
    labels: ['feature'],
    open: true,
    starred: false,
    related: [1],
  });
  seedIssue({
    title: 'Document the keyboard shortcuts',
    body: 'Press / to search. See #2, and #9, which was deleted.',
    author: 'Ada',
    labels: ['docs'],
    open: true,
    starred: false,
    related: [2, 9],
  });
  seedIssue({
    title: 'Links break on phones',
    body: 'Fixed by wrapping long titles.',
    author: 'Edsger',
    labels: ['bug'],
    open: false,
    starred: false,
  });
  log('Ada opened #1');
  log('Grace opened #2');
  log('Edsger closed #4');
}

resetStore();

export function allIssues(): Issue[] {
  return issues.toSorted((a, b) => b.id - a.id);
}

export function findIssue(id: number): Issue | undefined {
  return issues.find((issue) => issue.id === id);
}

export function addIssue(data: Pick<Issue, 'title' | 'body' | 'author' | 'labels'>): Issue {
  const issue: Issue = {
    ...data,
    id: nextId++,
    open: true,
    starred: false,
    related: [],
    created: new Date().toISOString(),
  };
  issues.push(issue);
  log(`${data.author} opened #${issue.id}`);
  return issue;
}

export function changeIssue(
  id: number,
  change: Partial<Pick<Issue, 'open' | 'starred'>>,
): Issue | undefined {
  const issue = findIssue(id);
  if (issue) {
    Object.assign(issue, change);
  }
  return issue;
}

export function removeIssue(id: number): void {
  issues = issues.filter((issue) => issue.id !== id);
}

export function log(text: string): void {
  activity.unshift({ id: nextEvent++, text, at: new Date().toISOString() });
  activity = activity.slice(0, 8);
}

export function recentActivity(): Activity[] {
  return [...activity];
}
