import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Writes every page of the site as a static HTML file, after the client and server builds.
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const client = path.join(root, 'dist/client');
const server = await import(path.join(root, 'dist/server/server.js'));
const manifest = JSON.parse(await readFile(path.join(client, '.vite/manifest.json'), 'utf8'));
const base = process.env.BASE ?? '/';
const entry = `${base}${manifest['src/client.ts'].file}`;

const paths = [
  '/',
  ...Object.keys(server.pages).map((name) => `/docs/${name}`.replace(/\/$/, '')),
  '/404',
];

await Promise.all(
  paths.map(async (page) => {
    const response: Response | undefined = await server.route(
      new Request(`http://localhost${page}`),
      { scripts: `<script type="module" async src="${entry}"></script>` },
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
