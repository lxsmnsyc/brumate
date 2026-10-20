import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';

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

const start = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>brumate todos</title>
    <style>.done { text-decoration: line-through; } li { cursor: pointer; }</style>
  </head>
  <body>
`;

const end = `
  </body>
</html>`;

/** Turns a Node request into a web Request, for server function calls. */
async function toRequest(request: IncomingMessage): Promise<Request> {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return new Request(`http://localhost${request.url}`, {
    method: request.method,
    headers: request.headers as Record<string, string>,
    body: request.method === 'POST' ? body : undefined,
  });
}

const http = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  try {
    // Server function calls.
    if (request.method === 'POST') {
      const answer = await server.handle(await toRequest(request));
      if (answer) {
        response.writeHead(answer.status, Object.fromEntries(answer.headers));
        response.end(await answer.text());
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
    const stream = server.renderToStream(
      server.App,
      {
        initial: [
          { id: '1', title: 'Write the docs', done: true },
          { id: '2', title: 'Build the compiler', done: false },
        ],
      },
      { start, scripts: `<script type="module" async src="${entry}"></script>`, end },
    );
    response.setHeader('content-type', 'text/html');
    Readable.fromWeb(stream).pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.end(String((error as Error).stack));
  }
});

const port = Number(process.env.PORT ?? 3000);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
