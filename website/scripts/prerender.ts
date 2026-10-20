import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Writes every page of the site as a static HTML file, after the client and server builds.
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const client = path.join(root, 'dist/client');
const server = await import(path.join(root, 'dist/server/server.js'));
const manifest = JSON.parse(await readFile(path.join(client, '.vite/manifest.json'), 'utf8'));
const base = process.env.BASE ?? '/';
const entry = `${base}${manifest['src/client.ts'].file}`;

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
    const what = !part
      ? 'entry'
      : part === 'all'
        ? 'handlers and updates'
        : part === 'update'
          ? 'updates'
          : part === 'shared'
            ? 'shared code'
            : `handler ${part}`;
    return `${name}: ${what}`;
  }
  return source.split('/').pop()!;
}

// The network panels of the demos show these names instead of hashed file names.
const names = Object.fromEntries(
  Object.entries(manifest as Record<string, { file: string }>).map(([source, chunk]) => [
    chunk.file.split('/').pop(),
    label(source),
  ]),
);
const head = `<script>window.__scriptNames=${JSON.stringify(names).replace(/</g, '\\u003c')}</script>`;

const paths = [
  '/',
  '/playground',
  ...Object.keys(server.pages).map((name) => `/docs/${name}`.replace(/\/$/, '')),
  '/404',
];

await Promise.all(
  paths.map(async (page) => {
    const response: Response | undefined = await server.route(
      new Request(`http://localhost${page}`),
      { head, scripts: `<script type="module" async src="${entry}"></script>` },
    );
    if (!response) {
      throw new Error(`No route for ${page}`);
    }
    const html = await response.text();
    const file =
      page === '/' ? 'index.html' : page === '/404' ? '404.html' : `${page.slice(1)}/index.html`;
    await mkdir(path.dirname(path.join(client, file)), { recursive: true });
    await writeFile(path.join(client, file), html);
    console.log(`${page} -> dist/client/${file}`);
  }),
);
