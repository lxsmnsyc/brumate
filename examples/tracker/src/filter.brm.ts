import { $memo, $signal } from 'brumate/signals';
import type { Issue } from './store.ts';

export type Status = 'open' | 'closed' | 'all';

export const STATUSES: Status[] = ['open', 'closed', 'all'];

/**
 * The search and status filter of a list of issues. The compiler copies this
 * body into the component that calls it, so its signals belong to that component.
 * `issues` is a name in the caller, so the filter follows it as it changes.
 */
export function issueFilter(issues: Issue[], initialQuery: string, initialStatus: string) {
  let query = $signal(initialQuery);
  let status = $signal<Status>(
    STATUSES.includes(initialStatus as Status) ? (initialStatus as Status) : 'open',
  );
  const words = $memo(query.toLowerCase().split(/\s+/).filter(Boolean));
  const visible = $memo(
    issues.filter(
      (issue) =>
        (status === 'all' || issue.open === (status === 'open')) &&
        words.every(
          (word) => issue.title.toLowerCase().includes(word) || issue.labels.includes(word),
        ),
    ),
  );
  const counts = $memo({
    open: issues.filter((issue) => issue.open).length,
    closed: issues.filter((issue) => !issue.open).length,
  });

  return {
    query,
    status,
    visible,
    counts,
    setQuery: (value: string) => (query = value),
    setStatus: (value: Status) => (status = value),
  };
}
