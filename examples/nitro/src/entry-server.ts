// Nitro calls `fetch` for each request that is not a file of the build.
import { handle } from 'virtual:brumate/routes';
import { handle as handleCall } from 'virtual:brumate/server';
// oxlint-disable-next-line import/default -- Nitro's Vite plugin makes this module.
import client from './client.ts?assets=client';

// In development, Vite's client updates components when files change.
const scripts = `${import.meta.env.DEV ? '<script type="module" src="/@vite/client"></script>' : ''}<script type="module" async src="${client.entry}"></script>`;

export default {
  async fetch(request: Request): Promise<Response> {
    // Server function calls.
    if (request.method === 'POST') {
      const answer = await handleCall(request);
      if (answer) {
        return answer;
      }
    }
    // Pages and endpoints, from the files under src/routes.
    return (await handle(request, { scripts })) ?? new Response('Not found', { status: 404 });
  },
};
