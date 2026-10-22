// Skew protection in the browser. A page loads again, or in full, when the
// site was deployed since it loaded. It does so once for each build in a
// tab, so a deploy whose files are broken, a cache that serves an old page,
// or a host that serves two builds at once cannot load pages in a loop.

const KEY = 'brumate:builds';

/**
 * True the first time in this tab that a page loads in full for `build`,
 * the build that it loads. The build is kept, so the next time is false.
 * Without session storage it is false, since the page cannot tell a loop.
 */
export function loadOnce(build: string): boolean {
  try {
    const builds = JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as string[];
    if (builds.includes(build)) {
      return false;
    }
    // The last builds are enough to stop a loop between two of them.
    sessionStorage.setItem(KEY, JSON.stringify([...builds, build].slice(-8)));
    return true;
  } catch {
    return false;
  }
}
