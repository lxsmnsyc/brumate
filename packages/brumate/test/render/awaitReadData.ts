/** Counts the runs of `fail`, so a test sees whether a memo computed. */
export function fail(): Promise<string> {
  const counts = globalThis as { failRuns?: number };
  counts.failRuns = (counts.failRuns ?? 0) + 1;
  return new Promise((_done, reject) => setTimeout(() => reject(new Error('await failed')), 10));
}
