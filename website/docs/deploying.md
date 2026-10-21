# Deploying

A brumate app builds into client files and a server bundle. The server renders pages and answers server function calls. A site without server functions can also be prerendered to static files.

## Build

The client and the server build separately, the client first:

```bash
vite build --outDir dist/client
vite build --ssr src/server.ts --outDir dist/server
```

The Vite config needs the manifest of the client build, so the server can find the client entry:

```ts
// vite.config.ts
import brumate from 'brumate/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate()],
  build: {
    manifest: true,
    rolldownOptions: { input: 'src/client.ts' },
  },
});
```

The server entry exports the two request handlers that the plugin builds:

```ts
// src/server.ts
// Server function calls.
export { handle } from 'virtual:brumate/server';
// Pages, endpoints and middleware of the route files.
export { handle as route } from 'virtual:brumate/routes';
```

## A production server

Any server that speaks web `Request` and `Response` can serve the build. A request goes to the server functions first, then to the client files, then to the routes:

```ts
// server.prod.ts
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { send, toRequest } from './node.ts';

const client = path.resolve('dist/client');
const server = await import(path.resolve('dist/server/server.js'));
const manifest = JSON.parse(await readFile(path.join(client, '.vite/manifest.json'), 'utf8'));
const entry = `/${manifest['src/client.ts'].file}`;

createServer(async (incoming, outgoing) => {
  const request = await toRequest(incoming);
  const { pathname } = new URL(request.url);

  // Server function calls.
  if (request.method === 'POST') {
    const answer = await server.handle(request);
    if (answer) {
      return send(answer, outgoing);
    }
  }
  // The built client files.
  if (pathname.startsWith('/assets/')) {
    outgoing.setHeader('cache-control', 'public, max-age=31536000, immutable');
    outgoing.end(await readFile(path.join(client, path.normalize(pathname))));
    return;
  }
  // Pages, streamed.
  send(
    await server.route(request, { scripts: `<script type="module" async src="${entry}"></script>` }),
    outgoing,
  );
}).listen(3000);
```

`toRequest` and `send` turn Node's request and response into web ones. [`examples/todos`](../../examples/todos) has them in `node.ts`, with the full server in `server.prod.ts`, which also sets content types and refuses paths outside `dist/client`.

- `route` returns `undefined` when no route matches and there is no root `_error.brm`. `send` answers with a 404 then.
- `send` writes the headers with `toNodeHeaders` from `brumate/server`, which keeps each `set-cookie` apart. `Object.fromEntries(answer.headers)` would join them, and the browser would keep only one cookie.
- Load the client entry with `async`, so it starts while `#loading` content is still streaming.
- Files under `/assets/` have hashes in their names, so they can be cached for a long time.

The server runtime keeps the request of each call with `AsyncLocalStorage`. Node, Deno and Bun have it. Cloudflare Workers have it with the `nodejs_compat` flag.

## Rendering without route files

An app without `src/routes` renders a root component itself with `renderToStream` from `brumate/server`:

```ts
import { renderToStream } from 'brumate/server';
import Root from './src/Root.brm';

const html = renderToStream(Root, {}, {
  request,
  scripts: '<script type="module" async src="/assets/client.js"></script>',
});
// The stream holds text, so it is encoded for the response.
return new Response(html.pipeThrough(new TextEncoderStream()), {
  headers: { 'content-type': 'text/html; charset=utf-8' },
});
```

- The first part of the page is sent as soon as it renders. `#loading` content follows as its data arrives.
- Pass `request`, so server functions and setup code can read it with `getRequest`.
- `nonce` sets a Content Security Policy nonce on the inline scripts that the stream adds.
- A root component that renders only part of a page takes `start` and `end` markup around it.

`render` returns the parts of a page instead of a stream. Use it to read the headers and the status that the page set before you send anything:

```ts
import { render } from 'brumate/server';

const page = await render(Root, {}, { request });
// page.status and page.headers come from setStatus and getResponseHeaders.
// page.html, page.head and page.state are the first render. page.pending streams the rest.
```

## Several roots on one page

A page from another tool can hold several brumate roots, such as islands. Render each one after the first with a `base` above the IDs of the one before it, so their state does not mix:

```ts
const header = await render(Header, {});
const cart = await render(Cart, {}, { base: header.next() });
```

One loader serves every root on the page.

## Prerendering

A site with no server functions, such as documentation, can be written to static files at build time:

```ts
brumate({ prerender: { paths: ['/'] } });
```

```bash
vite build --outDir dist/client && vite build --ssr src/server.ts --outDir dist/server
```

- After the server build, each path renders to an `index.html` in a folder of its path in `dist/client`.
- Links on a rendered page lead to more pages, which render too. `crawl: false` renders only the listed paths.
- The root `_error.brm` renders as `404.html`, which most static hosts show for a missing page.
- Pages that answer with another status, or with a redirect, are not written. Endpoints are not written either.
- Client navigation and layouts that keep their state work on a static host too.

Upload `dist/client` to the host. [Plugin options](./reference-plugin.md#prerenderoptions) lists every prerender option.

## Checklist

- Build the client before the server.
- Serve `dist/client/assets` with long cache headers.
- Send server function calls, `POST` requests to `/_brumate/…` by default, to `handle`.
- Set `origins` in the plugin options if pages on another origin of yours call server functions. See [Security](./reference-security.md).
- Check what each route ships with `report: true` or a `budget`. See [Inspect](./inspect.md).
