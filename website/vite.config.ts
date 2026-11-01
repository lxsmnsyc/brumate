import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import brumate from 'brumate/vite';
import { defineConfig } from 'vite';
import markdown, { SITE_PAGES, UI_PAGES } from './plugins/markdown.ts';
import search from './plugins/search.ts';
import showcase from './plugins/showcase.ts';

const require = createRequire(import.meta.url);

// `BASE` is the path the site is served from, such as `/brumate/`.
const base = process.env.BASE ?? '/';

/** A readable name for a built script, such as `Counter: handler h4`, from its source. */
function label(source: string): string {
  if (source === 'src/client.ts') {
    return 'loader';
  }
  if (source.endsWith('runtime/client.js')) {
    return 'core';
  }
  const runtime = /\/(navigate|rpc)-[\w-]+\.js$/.exec(source);
  if (runtime) {
    return runtime[1] === 'navigate' ? 'navigation' : 'server calls';
  }
  const component = /([\w.[\]-]+)\.brm\?brumate-client(?:&part=(\w+))?$/.exec(source);
  if (component) {
    const [, name, part] = component;
    let what = `handler ${part}`;
    if (!part) {
      what = 'entry';
    } else if (part === 'all') {
      what = 'handlers and updates';
    } else if (part === 'update') {
      what = 'updates';
    } else if (part === 'shared') {
      what = 'shared code';
    }
    return `${name}: ${what}`;
  }
  return source.split('/').pop()!;
}

/**
 * Names for the scripts of the build, so the network panels of the demos show them. The map is a
 * file of its own, named by its content, and the head of each page only links it: the panels fetch
 * it when one shows the list. Inlined, it was 10 kB of gzip on every page.
 */
function scriptNames(manifest: Record<string, { file: string }>): string {
  const names: Record<string, string> = {};
  for (const [source, chunk] of Object.entries(manifest)) {
    names[chunk.file.split('/').pop()!] = label(source);
  }
  const json = JSON.stringify(names);
  const file = `script-names-${createHash('sha256').update(json).digest('hex').slice(0, 8)}.json`;
  // The prerender step reads the client build from here.
  const client = fileURLToPath(new URL('dist/client', import.meta.url));
  writeFileSync(path.join(client, file), json);
  return `<link rel="script-names" href="${base}${file}">`;
}

/**
 * The address of the site, for link previews, which need absolute URLs. `SITE_URL` sets it.
 * On Vercel it is the production domain of the project.
 */
const siteUrl = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:5180')
).replace(/\/$/, '');

export default defineConfig({
  base,
  define: {
    'import.meta.env.SITE_URL': JSON.stringify(siteUrl),
  },
  plugins: [
    markdown(),
    showcase(),
    // The pages of the site. The design notes of the repository are not on it.
    search(
      [fileURLToPath(new URL('docs', import.meta.url))],
      new Set([...SITE_PAGES].map((page) => page || 'index')),
    ),
    // The pages of @brumate/ui have a search of their own.
    search(
      [fileURLToPath(new URL('ui', import.meta.url))],
      new Set([...UI_PAGES].map((page) => page || 'index')),
      'virtual:ui-search-index',
    ),
    // Every page is written as a static file, with readable names for the scripts.
    brumate({
      // The live samples and the REPL compile components in the browser, with any feature.
      features: 'all',
      navigate: { transition: true },
      prerender: { paths: ['/', '/repl', '/ui'], head: scriptNames },
    }),
  ],
  resolve: {
    alias: {
      // The browser build of oxc-parser imports its WebAssembly binding by this name.
      '@oxc-parser/binding-wasm32-wasip1': path.join(
        path.dirname(require.resolve('@oxc-parser/binding-wasm32-wasi/package.json')),
        'parser.wasi-browser.js',
      ),
      // The live samples strip types with oxc-transform on WebAssembly.
      '@oxc-transform/binding-wasm32-wasip1': path.join(
        path.dirname(require.resolve('@oxc-transform/binding-wasm32-wasi/package.json')),
        'transform.wasi-browser.js',
      ),
    },
  },
  // The compiler of the REPL and the live samples parses with oxc on WebAssembly, which loads its files itself.
  optimizeDeps: {
    exclude: [
      'oxc-parser',
      '@oxc-parser/binding-wasm32-wasi',
      'oxc-transform',
      '@oxc-transform/binding-wasm32-wasi',
    ],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2023',
    // The REPL chunk holds the compiler and PostCSS.
    chunkSizeWarningLimit: 1200,
    // The prerender script reads the manifest to find the built client entry.
    manifest: true,
    rolldownOptions: {
      input: 'src/client.ts',
    },
  },
});
