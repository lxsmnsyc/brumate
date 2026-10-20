/**
 * Describes what a component ships, at build time: `import x from
 * './Counter.brm?inspect'` gives its highlighted source and the report of
 * `brumate inspect`, from the same compiler that builds the site.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inspect } from 'brumate';
import type { Plugin } from 'vite';
import { language as brm } from '../src/highlight/brm.ts';

const QUERY = '?inspect';

export default function showcase(): Plugin {
  const highlight = brm();
  let root = process.cwd();
  return {
    name: 'website:showcase',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    async load(id) {
      if (!id.endsWith(QUERY)) {
        return null;
      }
      const file = id.slice(0, -QUERY.length);
      const source = await readFile(file, 'utf8');
      // The same merge size as the Vite plugin, so the report matches what the site ships.
      const { report } = inspect(source, { filename: path.relative(root, file), merge: 2048 });
      const summary = {
        name: report.name,
        roots: report.roots.map((entry) => ({ label: entry.label, reason: entry.reason })),
        changes: report.changes.map((entry) => ({ label: entry.label, reason: entry.reason })),
        state: report.state,
        staticMarkup: report.staticMarkup,
        sizes: report.sizes,
      };
      return [
        "import { raw } from 'brumate/html';",
        `export const source = raw(${JSON.stringify(`<pre class="code">${highlight(source.trim())}</pre>`)});`,
        `export const report = ${JSON.stringify(summary)};`,
      ].join('\n');
    },
  };
}
