import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { send, toRequest } from './node.ts';

// Serves the production build: `pnpm build` writes dist/client and dist/server.
const root = path.dirname(new URL(import.meta.url).pathname);
const client = path.join(root, 'dist/client');
const server = await import(path.join(root, 'dist/server/server.js'));
const manifest = JSON.parse(await readFile(path.join(client, '.vite/manifest.json'), 'utf8'));
const entry = `/${manifest['src/client.ts'].file}`;

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
};

const http = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  try {
    // One request for both handlers, because its body can be read once.
    const webRequest = await toRequest(request);
    // Server function calls.
    if (request.method === 'POST') {
      const answer = await server.handle(webRequest);
      if (answer) {
        send(answer, response);
        return;
      }
    }
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
    // The route files under src/routes render the page.
    const answer = await server.route(webRequest, {
      scripts: `<script type="module" async src="${entry}"></script>`,
      // The browser starts to load the loader and the core while the page renders.
      earlyHints: (link: string[]) => response.writeEarlyHints({ link }),
    });
    send(answer, response);
  } catch (error) {
    response.statusCode = 500;
    response.end(String((error as Error).stack));
  }
});

const port = Number(process.env.PORT ?? 3000);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
