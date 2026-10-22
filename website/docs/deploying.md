# Deploying

A brumate app builds into client files and a server bundle. The server renders pages and answers server function calls. A site without server functions can also be prerendered to static files.

[Nitro](https://nitro.build) builds the app for a host, such as Node, Bun, Deno, Cloudflare or Vercel, without a server of your own. See [Deploying with Nitro](#deploying-with-nitro). The sections after it describe a server that you write yourself.

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

## Deploying with Nitro

Add Nitro's Vite plugin after brumate's, and name the client entry:

```ts
// vite.config.ts
import brumate from 'brumate/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [brumate(), nitro()],
  environments: {
    client: { build: { rollupOptions: { input: 'src/client.ts' } } },
  },
});
```

Nitro uses `src/entry-server.ts` for each request that is not a file of the build. Its `fetch` answers server function calls, then routes:

```ts
// src/entry-server.ts
import { handle } from 'virtual:brumate/routes';
import { handle as handleCall } from 'virtual:brumate/server';
import client from './client.ts?assets=client';

const scripts = `${import.meta.env.DEV ? '<script type="module" src="/@vite/client"></script>' : ''}<script type="module" async src="${client.entry}"></script>`;

export default {
  // Nitro's request has `ip`, the address of the socket, for rate limits.
  async fetch(request: Request & { ip?: string }): Promise<Response> {
    const address = request.ip;
    if (request.method === 'POST') {
      const answer = await handleCall(request, { address });
      if (answer) {
        return answer;
      }
    }
    return (
      (await handle(request, { scripts, address })) ?? new Response('Not found', { status: 404 })
    );
  },
};
```

- `vite dev` runs the app. Nitro renders pages in a worker, and calls of server functions go to the entry, so they share its memory. Edits update the page as in [Edit while it runs](./getting-started.md#edit-while-it-runs).
- `vite build` writes `.output`. `node .output/server/index.mjs` serves it, and `vite preview` too.
- `NITRO_PRESET`, or `preset` in the options of `nitro()`, builds for another host, such as `cloudflare-module` or `vercel`. The example is tested with the default Node preset. Brumate needs no Node APIs at runtime, so no compatibility flag is needed.
- Pass the address of the client as `address`, for rate limits and `clientAddress`: `request.ip` on Nitro, which is the address of the socket, or the `cf-connecting-ip` header on Cloudflare. Without it, a rate limit with no `key` throws in production. Behind a proxy, name it with `configureRateLimit({ proxies })`. See [Rate limiting](./server-functions.md#rate-limiting).
- A host that stops a function when its response ends, such as Cloudflare Workers, gives `fetch` a context with `waitUntil`. Pass it on, as `handle(request, { scripts, waitUntil: (promise) => context.waitUntil(promise) })`, and `event.waitUntil` keeps work going on the host.
- `client.ts?assets=client` gives the URL of the client entry, in development and in the build. Add `nitro/vite/types` to the `types` of `tsconfig.json` for its type.
- Nitro is in beta. The example uses version `3.0.260903-beta`.

[`examples/nitro`](https://github.com/lxsmnsyc/brumate/tree/main/examples/nitro) is a complete app.

## Skew protection

A resumable page lives long and loads its code late. A page that was open before a deploy loads the parts of its handlers after it, and calls server functions that the new build may have changed. Skew protection keeps such a page working, or loads it again:

- Each build has an ID. The client build writes it to `dist/client/.brumate/build.json`, and the server build reads it, so build the client first. `BRUMATE_BUILD` in the environment names the ID for both builds, such as the commit in CI.
- The page state carries the ID, and the browser sends it with each server function call and each request for a `#defer` body. A call to a function that still exists runs. A call to a function that is gone answers 409 with the build of the server, and the browser loads the next page in full. A form of `$action` posts again without scripts, and the page that answers is of the new build.
- A form that posts to a server function carries the ID in its URL, as `__build`, so a post without scripts is checked too. A post from another build to a function that is gone answers 303 to its page, from `Referer`, or to `/` when the page is on another site. The page then loads with the new build.
- When the code of a handler fails to load, the browser asks the server for its build. When it differs, the files of the old build may be gone, and the page loads again. Any other error, such as a module that throws when it loads, goes to the nearest `#try`, as the error of a handler does.
- Client navigation compares the build of the next page with its own, and loads the page in full when they differ, because the layouts that it would keep are code of the old build.
- A page loads again, or in full, once for each build in a tab. The tab keeps the builds in session storage. So a deploy whose files are broken, a cache that still serves the old page, or two builds that answer in turn during a deploy cannot load pages in a loop. The next time, the error goes to `#try`, or client navigation swaps the page in. Without session storage, the page does not load again.
- The page gets a `brumate:skew` event when it notices a deploy, with `'call'`, `'code'` or `'defer'` in `detail`, before anything loads again. An app can save a draft in it.

The files of the client build have hashes in their names, so the files of earlier builds can stay next to the new ones for the pages that are still open. `skew: { keep: 2 }` keeps the files of the two builds before the last one: the build does not empty `dist/client`, lists its builds in `.brumate/builds.json`, and removes the files of older builds itself. A host that serves the directory as it is then serves old pages their code for two deploys.

```ts
// vite.config.ts
export default defineConfig({
  plugins: [brumate({ skew: { keep: 2 } })],
});
```

The dev server has no build ID, so nothing is checked there.

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
  const address = incoming.socket.remoteAddress;

  // Server function calls.
  if (request.method === 'POST') {
    const answer = await server.handle(request, { address });
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
    await server.route(request, {
      scripts: `<script type="module" async src="${entry}"></script>`,
      address,
    }),
    outgoing,
  );
}).listen(3000);
```

`toRequest` and `send` turn Node's request and response into web ones. [`examples/todos`](../../examples/todos) has them in `node.ts`, with the full server in `server.prod.ts`, which also sets content types and refuses paths outside `dist/client`.

- `route` returns `undefined` when no route matches and there is no root `_error.brm`. `send` answers with a 404 then.
- `send` writes the headers with `toNodeHeaders` from `brumate/server`, which keeps each `set-cookie` apart. `Object.fromEntries(answer.headers)` would join them, and the browser would keep only one cookie.
- Load the client entry with `async`, so it starts while `#loading` content is still streaming.
- Files under `/assets/` have hashes in their names, so they can be cached for a long time.

The server runtime uses only web APIs, such as `Request`, `Response` and `crypto.subtle`, so it runs on Node, Deno, Bun and edge hosts such as Cloudflare Workers.

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
- Pass `request`, so components and the server functions that their memos call can read it with `getEvent()`.
- `nonce` sets a Content Security Policy nonce on the inline scripts that the stream adds.
- A root component that renders only part of a page takes `start` and `end` markup around it.

`render` returns the parts of a page instead of a stream. Use it to read the headers and the status that the page set before you send anything:

```ts
import { render } from 'brumate/server';

const page = await render(Root, {}, { request });
// page.status and page.headers come from the event of the page, such as event.setStatus and event.setCookie.
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

### `#defer` on prerendered pages

The body of a [`#defer`](./control-flow.md#defer) block renders on the server, also on a prerendered page, such as a line that names the user who is signed in. The browser asks for it at the URL of the page, with the header `x-brumate-defer`. A server that serves prerendered files sends those requests to the routes instead:

```ts
if (request.method === 'GET' && !request.headers['x-brumate-defer']) {
  // Serve the prerendered file, if there is one.
}
// Render the route.
```

A static host without a server answers with the file, and the block keeps its fallback.

### Content Security Policy for prerendered pages

A prerendered page is rendered once, so its inline scripts have no nonce. The build writes the SHA-256 hashes of each page's inline scripts to `dist/client/.brumate/prerender.json`:

```json
{
  "pages": {
    "/about": { "file": "about/index.html", "scripts": ["sha256-…", "sha256-…"] }
  },
  "scripts": ["sha256-…", "sha256-…"]
}
```

- `pages` has the hashes of each page. The error page is `404`.
- `scripts` has the hashes of every page, once each.

Send a policy with the hashes:

```ts
import prerendered from './dist/client/.brumate/prerender.json' with { type: 'json' };

const hashes = prerendered.scripts.map((hash) => `'${hash}'`).join(' ');
const policy = `script-src 'self' ${hashes}`;
```

Use the hashes of every page in one policy. The client router keeps the policy of the page that the browser loaded, and runs the scripts of the next page under it. A policy that requires Trusted Types adds `trusted-types brumate`. See [Trusted Types](./reference-security.md#trusted-types).

A policy with hashes cannot cover a page that the server renders on each request. When a server of your own sends both kinds of pages, give the prerendered files a nonce as it sends them, and use the nonce policy for every page:

```ts
const html = (await readFile(file, 'utf8')).replaceAll('<script', `<script nonce="${nonce}"`);
```

## Checklist

- Build the client before the server.
- Serve `dist/client/assets` with long cache headers.
- Send server function calls, `POST` requests to `/_brumate/…` by default, to `handle`.
- Set `origins` in the plugin options if pages on another origin of yours call server functions. See [Security](./reference-security.md).
- Check what each route ships with `report: true` or a `budget`. See [Inspect](./inspect.md).
