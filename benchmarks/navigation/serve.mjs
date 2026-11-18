import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { freePort, repo, startProcess } from '../../e2e/lib.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

/**
 * The website as a static host serves it, with the repo's preview script: every page is the HTML
 * that the build prerendered, and the host ignores the headers of a navigation.
 */
export async function serveStatic() {
  const root = path.join(repo, 'website');
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const stop = await startProcess(process.execPath, ['scripts/preview.ts'], {
    cwd: root,
    env: { PORT: String(port) },
    url,
  });
  return { url, stop };
}

/**
 * The production build of an app behind its server: every page is rendered by `route`, as a
 * deployment with a server does, and the files of `dist/client` are served with a cache that never
 * expires, as a CDN does. There is no content security policy, which the numbers do not depend on.
 */
export async function serveServer(root) {
  const client = path.join(root, 'dist/client');
  if (!existsSync(path.join(root, 'dist/server/server.js'))) {
    throw new Error(`${path.relative(repo, root)}/dist is missing. Run without --no-build.`);
  }
  const server = await import(pathToFileURL(path.join(root, 'dist/server/server.js')).href);
  const manifest = JSON.parse(readFileSync(path.join(client, '.vite/manifest.json'), 'utf8'));
  const entry = `/${manifest['src/client.ts'].file}`;
  let pages = 0;

  const http = createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const webRequest = new Request(`http://${request.headers.host}${request.url}`, {
        method: request.method,
        headers: request.headers,
        body: request.method === 'POST' ? Buffer.concat(chunks) : undefined,
      });
      let answer;
      if (request.method === 'POST') {
        answer = await server.handle(webRequest);
      }
      if (!answer && request.method === 'GET' && url.pathname.startsWith('/assets/')) {
        const file = path.join(client, path.normalize(url.pathname));
        if (file.startsWith(client) && existsSync(file)) {
          response.setHeader(
            'content-type',
            TYPES[path.extname(file)] ?? 'application/octet-stream',
          );
          response.setHeader('cache-control', 'public, max-age=31536000, immutable');
          response.end(await readFile(file));
          return;
        }
      }
      const nonce = `n${++pages}`;
      answer ??= await server.route(webRequest, {
        nonce,
        scripts: `<script type="module" async nonce="${nonce}" src="${entry}"></script>`,
      });
      if (!answer) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      const headers = {};
      for (const [name, value] of answer.headers) {
        if (name !== 'set-cookie') {
          headers[name] = value;
        }
      }
      response.writeHead(answer.status, headers);
      if (answer.body) {
        Readable.fromWeb(answer.body).pipe(response);
      } else {
        response.end();
      }
    } catch (error) {
      response.statusCode = 500;
      response.end(String(error?.stack ?? error));
    }
  });
  await new Promise((resolve) => http.listen(0, resolve));
  return {
    url: `http://localhost:${http.address().port}`,
    stop: () =>
      new Promise((resolve) => {
        http.closeAllConnections();
        http.close(resolve);
      }),
  };
}
