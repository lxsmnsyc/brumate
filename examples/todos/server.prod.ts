import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import path from 'node:path';
import { toNodeHandler } from 'srvx/node';

// Serves the production build: `pnpm build` writes dist/client and dist/server. The script tag
// is the default: brumate reads the entry from the client build, which comes first.
const root = path.dirname(new URL(import.meta.url).pathname);
const client = path.join(root, 'dist/client');
const server = await import(path.join(root, 'dist/server/server.js'));

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
};

/** The request of srvx on Node, which reaches the response for the early hints. */
type NodeRequest = Request & {
  runtime?: { node?: { res?: { writeEarlyHints?: (hints: { link: string[] }) => void } } };
};

const render = toNodeHandler(async (request: Request) => {
  // Server function calls.
  if (request.method === 'POST') {
    const answer = await server.handle(request);
    if (answer) {
      return answer;
    }
  }
  // The route files under src/routes render the page.
  const answer = await server.route(request, {
    // The browser starts to load the loader and the core while the page renders.
    earlyHints: (link: string[]) =>
      (request as NodeRequest).runtime?.node?.res?.writeEarlyHints?.({ link }),
  });
  return answer ?? new Response('Not found', { status: 404 });
}) as RequestListener;

const http = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  try {
    // Built client modules.
    if (url.pathname.startsWith('/assets/')) {
      const file = path.join(client, path.normalize(url.pathname));
      if (!file.startsWith(client)) {
        response.statusCode = 403;
        response.end();
        return;
      }
      response.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
      return;
    }
    await render(request, response);
  } catch (error) {
    response.statusCode = 500;
    response.end(String((error as Error).stack));
  }
});

const port = Number(process.env.PORT ?? 3000);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
