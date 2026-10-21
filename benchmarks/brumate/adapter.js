import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'brumate';

export async function load() {
  const server = await import(`${dir}dist/server/server.js`);
  const manifest = JSON.parse(await readFile(`${dir}dist/client/.vite/manifest.json`, 'utf8'));
  const scripts = `<script type="module" async src="/${manifest['src/client.ts'].file}"></script>`;
  return {
    staticDir: `${dir}dist/client`,
    render: (n) => server.page(n, scripts),
  };
}
