import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'Qwik 2';

export async function load() {
  const server = await import(`${dir}dist/server/entry.ssr.js`);
  return {
    staticDir: `${dir}dist/client`,
    render: async (n) => (await server.default({ serverData: { n } })).html,
  };
}
