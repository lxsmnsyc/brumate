// Serves one framework's build: the SSR page at / (with ?n=<todos>) and its static client files.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { loadAdapter } from './frameworks.mjs';

const TYPES = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const name = process.argv[2];
const app = await (await loadAdapter(name)).load();
const root = path.resolve(app.staticDir);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  response.setHeader('cache-control', 'no-store');
  try {
    if (url.pathname === '/') {
      const html = await app.render(
        Number(url.searchParams.get('n') ?? process.env.BENCH_TODOS ?? 3),
      );
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(html);
      return;
    }
    const file = path.join(root, path.normalize(decodeURIComponent(url.pathname)));
    if (!file.startsWith(root + path.sep)) {
      response.statusCode = 403;
      response.end();
      return;
    }
    const body = await readFile(file);
    response.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    response.end(body);
  } catch (error) {
    response.statusCode = error?.code === 'ENOENT' || error?.code === 'EISDIR' ? 404 : 500;
    response.end();
  }
});

server.listen(Number(process.env.PORT ?? 0), '127.0.0.1', () => {
  console.log(`ready ${server.address().port}`);
});
