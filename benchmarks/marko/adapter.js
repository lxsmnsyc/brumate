import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'Marko 6';

export async function load() {
  const server = await import(`${dir}dist/server/server.js`);
  return {
    staticDir: `${dir}dist/client`,
    render: (n) => server.render(n),
  };
}

export async function loadDashboard() {
  const server = await import(`${dir}dashboard/dist/server/server.js`);
  return {
    staticDir: `${dir}dashboard/dist/client`,
    // Marko loads all of a page's code at start. It has no preload to turn off.
    preloadOption: false,
    render: () => server.render(),
  };
}

export async function loadRows() {
  const server = await import(`${dir}rows/dist/server/server.js`);
  return {
    staticDir: `${dir}rows/dist/client`,
    render: (n) => server.render(n),
  };
}
