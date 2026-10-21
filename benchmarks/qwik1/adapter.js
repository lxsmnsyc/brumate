import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'Qwik 1';

export async function load() {
  const server = await import(`${dir}dist/server/entry.ssr.js`);
  return {
    staticDir: `${dir}dist/client`,
    render: async (n) => (await server.default({ serverData: { n } })).html,
  };
}

export async function loadDashboard() {
  const server = await import(`${dir}dashboard/dist/server/entry.ssr.js`);
  return {
    staticDir: `${dir}dashboard/dist/client`,
    preloadOption: true,
    render: async ({ preload = true } = {}) =>
      (await server.default(preload ? {} : { preloader: false })).html,
  };
}
