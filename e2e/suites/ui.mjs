// The production build of examples/ui, a page of every part of @brumate/ui. The steps of each
// part are in ./ui/, listed in ./ui/index.mjs, and the last ones check the page with axe-core.
import path from 'node:path';
import { repo, serveNitro, watch, watchPolicy } from '../lib.mjs';
import { parts } from './ui/index.mjs';

const root = path.join(repo, 'examples/ui');

// NODE_ENV=production, because Nitro builds for development under another value.
export const build = [
  ['pnpm', ['--filter', 'example-ui', 'build'], { env: { NODE_ENV: 'production' } }],
];

/** Serves the Nitro build of examples/ui behind a Trusted Types policy. */
export function start() {
  return serveNitro(root);
}

export async function run({ browser, url, runner }) {
  const page = await browser.newPage();
  const errors = watch(page);
  watchPolicy(page, errors);
  const step = runner.flow('ui', { page, errors });

  // The parts run in the order of the list, on one page.
  for (const load of parts) {
    const { steps } = await load();
    await steps({ page, url, step });
  }
}
