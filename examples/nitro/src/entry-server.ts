// Nitro calls `fetch` for each request that is not a file of the build.
import { setCacheStore, storageStore } from 'brumate/server';
import { useStorage } from 'nitro/storage';
import { handle } from 'virtual:brumate/routes';
import { handle as handleCall } from 'virtual:brumate/server';
// oxlint-disable-next-line import/default -- Nitro's Vite plugin makes this module.
import client from './client.ts?assets=client';

// Results of `cached` and the pages that the server keeps live in Nitro's storage, whose
// drivers include Redis and Cloudflare KV.
setCacheStore(storageStore(useStorage('cache')));

// In development, Vite's client updates components when files change.
const scripts = `${import.meta.env.DEV ? '<script type="module" src="/@vite/client"></script>' : ''}<script type="module" async src="${client.entry}"></script>`;

export default {
  // Nitro's request has `ip`, the address of the socket, for rate limits.
  async fetch(request: Request & { ip?: string }): Promise<Response> {
    const address = request.ip;
    // Server function calls.
    if (request.method === 'POST') {
      const answer = await handleCall(request, { address });
      if (answer) {
        return answer;
      }
    }
    // Pages and endpoints, from the files under src/routes.
    return (
      (await handle(request, { scripts, address })) ?? new Response('Not found', { status: 404 })
    );
  },
};
