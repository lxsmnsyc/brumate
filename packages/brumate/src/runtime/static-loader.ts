// The loader without client navigation, for `navigate: false`. It is a module
// of its own, so a bundle that starts it has no import of the navigation code,
// and keeps none of the core's exports that only navigation reads.

import { boot } from './boot.ts';
import type { LoaderOptions } from './boot.ts';

export type { LoaderOptions } from './boot.ts';

/**
 * `start` for a site that loads every page with a full page load, as with
 * `navigate: false`. A bundle that only calls it leaves out the code of
 * client navigation.
 */
export function startWithoutNavigation(options: LoaderOptions): () => void {
  return boot(options);
}
