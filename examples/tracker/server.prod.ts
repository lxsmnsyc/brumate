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
  '.html': 'text/html; charset=utf-8',
};

/** A file of the client build, or undefined when there is none at that path. */
async function file(pathname: string): Promise<{ type: string; body: Buffer } | undefined> {
  const name = path.join(client, path.normalize(pathname));
  if (!name.startsWith(client)) {
    return undefined;
  }
  try {
    return {
      type: TYPES[path.extname(name)] ?? 'application/octet-stream',
      body: await readFile(name),
    };
  } catch {
    return undefined;
  }
}

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
    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const found = await file(url.pathname);
      if (found) {
        response.setHeader('content-type', found.type);
        response.end(found.body);
        return;
      }
    }
    // A page that the build prerendered, such as /about, goes to the routes as the shell of the
    // answer. They send it at once, and the bodies of its `#defer` blocks after it, such as the
    // line about the user, in place of a request for each.
    const prerendered =
      request.method === 'GET' && !url.pathname.startsWith('/assets/')
        ? await file(path.join(url.pathname, 'index.html'))
        : undefined;
    if (prerendered) {
      send(await server.route(webRequest, { shell: prerendered.body.toString('utf8') }), response);
      return;
    }
    // The route files under src/routes render every other page.
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
