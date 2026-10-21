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
