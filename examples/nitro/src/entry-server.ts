// Nitro calls `fetch` for each request that is not a file of the build.
import { setCacheStore, storageStore } from 'brumate/server';
import { useStorage } from 'nitro/storage';
import { handle } from 'virtual:brumate/routes';
import { handle as handleCall } from 'virtual:brumate/server';

// Results of `cached` and the pages that the server keeps live in Nitro's storage, whose
// drivers include Redis and Cloudflare KV.
setCacheStore(storageStore(useStorage('cache')));

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
    return (await handle(request, { address })) ?? new Response('Not found', { status: 404 });
  },
};
