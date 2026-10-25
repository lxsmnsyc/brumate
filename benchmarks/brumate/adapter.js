import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'brumate';

async function entry(root) {
  const manifest = JSON.parse(await readFile(`${root}/dist/client/.vite/manifest.json`, 'utf8'));
  // The links that a page of `handleRoute` gets from the build: the loader, the core and the
  // bundle of the page's root component. Each app here has one root.
  const hints = JSON.parse(await readFile(`${root}/dist/client/.brumate/hints.json`, 'utf8'));
  const urls = [...new Set([...hints.all, ...Object.values(hints.bundles).flat()])];
  const links = urls.map((url) => `<link rel="modulepreload" href="${url}">`).join('');
  return `${links}<script type="module" async src="/${manifest['src/client.ts'].file}"></script>`;
}

export async function load() {
  const server = await import(`${dir}dist/server/server.js`);
  const scripts = await entry(dir);
  return {
    staticDir: `${dir}dist/client`,
    render: (n) => server.page(n, scripts),
  };
}

export async function loadDashboard() {
  const server = await import(`${dir}dashboard/dist/server/server.js`);
  const scripts = await entry(`${dir}dashboard`);
  return {
    staticDir: `${dir}dashboard/dist/client`,
    // The code of the page loads when it starts. There is no preload to turn off.
    preloadOption: false,
    render: () => server.page(scripts),
  };
}

export async function loadRows() {
  const server = await import(`${dir}rows/dist/server/server.js`);
  const scripts = await entry(`${dir}rows`);
  return {
    staticDir: `${dir}rows/dist/client`,
    render: (n) => server.page(n, scripts),
  };
}
