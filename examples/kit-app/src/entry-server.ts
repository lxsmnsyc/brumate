// Nitro calls `fetch` for each request that is not a file of the build.
import { handle } from 'virtual:brumate/routes';
import { handle as handleCall } from 'virtual:brumate/server';

/** The parts of Nitro's request that this file reads. */
type NitroRequest = Request & {
  ip?: string;
  runtime?: { node?: { res?: { writeEarlyHints?: (hints: { link: string[] }) => void } } };
};

export default {
  async fetch(request: NitroRequest): Promise<Response> {
    const address = request.ip;
    // Server function calls.
    if (request.method === 'POST') {
      const answer = await handleCall(request, { address });
      if (answer) {
        return answer;
      }
    }
    // Pages and endpoints, from the files under src/routes.
    const options = {
      address,
      // The browser starts to load the loader and the core while the page renders. Only Node has
      // `writeEarlyHints`.
      earlyHints: (link: string[]) => request.runtime?.node?.res?.writeEarlyHints?.({ link }),
    };
    const answer = await handle(request, options);
    return answer ?? new Response('Not found', { status: 404 });
  },
};
