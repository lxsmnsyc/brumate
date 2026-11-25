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
    // A nonce for the scripts of this response: the pages write it on their script tags, and the
    // policy below allows only those.
    const nonce = btoa(crypto.randomUUID());
    const options = {
      address,
      nonce,
      // The browser starts to load the loader and the core while the page renders. Only Node has
      // `writeEarlyHints`.
      earlyHints: (link: string[]) => request.runtime?.node?.res?.writeEarlyHints?.({ link }),
    };
    const answer = await handle(request, options);
    if (!answer) {
      return new Response('Not found', { status: 404 });
    }
    if (!answer.headers.get('content-type')?.includes('text/html')) {
      return answer;
    }
    const page = new Response(answer.body, answer);
    page.headers.set(
      'content-security-policy',
      `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`,
    );
    return page;
  },
};
