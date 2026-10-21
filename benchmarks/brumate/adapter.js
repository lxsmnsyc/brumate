import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'brumate';

async function entry(root) {
  const manifest = JSON.parse(await readFile(`${root}/dist/client/.vite/manifest.json`, 'utf8'));
  return `<script type="module" async src="/${manifest['src/client.ts'].file}"></script>`;
}

export async function load() {
  const server = await import(`${dir}dist/server/server.js`);
  const scripts = await entry(dir);
  return {
    staticDir: `${dir}dist/client`,
    render: (n) => server.page(n, scripts),
  };
}

// The loader skips its idle preload when the browser asks to save data, the same check as the
// plugin's `preload: false`. Setting it in the page turns the preload off without a second build.
const SAVE_DATA =
  "<script>Object.defineProperty(navigator, 'connection', { value: { saveData: true } });</script>";

export async function loadDashboard() {
  const server = await import(`${dir}dashboard/dist/server/server.js`);
  const scripts = await entry(`${dir}dashboard`);
  return {
    staticDir: `${dir}dashboard/dist/client`,
    preloadOption: true,
    render: ({ preload = true } = {}) => server.page(preload ? scripts : SAVE_DATA + scripts),
  };
}
