# Deploying

A brumate app builds into client files and a server bundle. The server renders pages and answers server function calls. Pages without data can also be prerendered to static files.

[Nitro](https://nitro.build) is the production server. It builds the app for a host, such as Node, Bun, Deno, Cloudflare or Vercel. See [Deploying with Nitro](#deploying-with-nitro). brumate has no adapters of its own. An app that needs its own Node server uses `toNodeHandler` from `srvx/node`, as in [A server of your own](#a-server-of-your-own).

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
    return (await handle(request, { address })) ?? new Response('Not found', { status: 404 });
  },
};
```

- `vite dev` runs the app. Nitro renders pages in a worker, and calls of server functions go to the entry, so they share its memory. Edits update the page as in [Edit while it runs](./getting-started.md#edit-while-it-runs).
- `vite build` writes `.output`. `node .output/server/index.mjs` serves it, and `vite preview` too.
- `NITRO_PRESET`, or `preset` in the options of `nitro()`, builds for another host, such as `cloudflare-module` or `vercel`. The example is tested with the default Node preset. Brumate needs no Node APIs at runtime, so no compatibility flag is needed.
- Pass the address of the client as `address`, for rate limits and `clientAddress`: `request.ip` on Nitro, which is the address of the socket, or the `cf-connecting-ip` header on Cloudflare. Without it, a rate limit with no `key` throws in production. Behind a proxy, name it with `configureRateLimit({ proxies })`. See [Rate limiting](./security.md#rate-limiting).
- A host that stops a function when its response ends, such as Cloudflare Workers, gives `fetch` a context with `waitUntil`. Pass it on, as `handle(request, { waitUntil: (promise) => context.waitUntil(promise) })`, and `event.waitUntil` keeps work going on the host.
- The entry writes no script tags. `handle` adds them: the Vite client and `virtual:brumate/start` in development, and the hashed client entry in the build. The server environment reads the entry from the manifest of the client environment, which `vite build` builds first. Set `clientOutDir` in the options of `brumate()` when the client builds to another directory. See [The script tags](#the-script-tags).
- Keep the results of [`cached`](./server-functions.md#results-that-requests-share) and the pages that the server keeps in Nitro's storage, so every instance of the app shares them: `setCacheStore(storageStore(useStorage('cache')))` at the top of the entry, with `useStorage` from `nitro/storage`. Configure the `cache` mount with a driver such as Redis in the options of `nitro()`.
- For a Content Security Policy, pass a new `nonce` to `handle` for each request and send it in the policy. The script tags get it. See [Content Security Policy](./reference-security.md#content-security-policy).
- `prerender` in the options of `brumate()` writes pages to `.output/public` in the same build. See [Prerendering](#prerendering).
- Nitro is in beta. The example uses version `3.0.260903-beta`.

[`examples/nitro`](https://github.com/lxsmnsyc/brumate/tree/main/examples/nitro) is a complete app. The examples `tracker`, `hackernews`, `ui`, `kit-app` and `browser-async` run on Nitro too. [`examples/tracker`](https://github.com/lxsmnsyc/brumate/tree/main/examples/tracker) adds a nonce policy and prerendered pages.

## A server of your own

A server of your own serves the app on Node without Nitro. `toNodeHandler` from [`srvx/node`](https://srvx.h3.dev) turns a function from web `Request` to `Response` into a Node request listener. brumate then gets the request with its method, headers and body. [`examples/todos`](https://github.com/lxsmnsyc/brumate/tree/main/examples/todos) is a complete app built this way.

```bash
pnpm add srvx
```

### In development

Vite runs in middleware mode inside the server. Vite serves the client modules and answers server function calls, and the server renders the pages:

```ts
// server.ts
import { createServer as createHTTPServer } from 'node:http';
import type { RequestListener } from 'node:http';
import { errorPage } from 'brumate/vite';
import { toNodeHandler } from 'srvx/node';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

const render = toNodeHandler(async (request) => {
  try {
    const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
    return (await handle(request)) ?? new Response('Not found', { status: 404 });
  } catch (error) {
    return new Response(errorPage(error, vite), {
      status: 500,
      headers: { 'content-type': 'text/html' },
    });
  }
}) as RequestListener;

createHTTPServer((request, response) => {
  vite.middlewares(request, response, () => render(request, response));
}).listen(5173);
```

- With `middlewareMode`, the plugin leaves the pages to this server. It does not answer them itself, as it does under `vite dev`.
- `handle` adds the script tags of development, as under `vite dev`.
- `errorPage` answers with the Errors tab of the devtools when a page fails to render. See [`errorPage`](./reference-plugin.md#errorpageerror-server).
- `toNodeHandler` returns a union of handler types. `as RequestListener` makes it callable from `node:http`.

### Build

The client and the server build separately, the client first:

```bash
vite build --outDir dist/client
vite build --ssr src/server.ts --outDir dist/server
```

The server build reads the file of the client entry from the manifest of the client build, which the plugin turns on. A server build that finds no client manifest fails with "Build the client first". When the client builds to a directory other than `dist/client`, set `clientOutDir` in the options of `brumate()`.

The server entry exports the two request handlers that the plugin builds:

```ts
// src/server.ts
// Server function calls.
export { handle } from 'virtual:brumate/server';
// Pages, endpoints and middleware of the route files.
export { handle as route } from 'virtual:brumate/routes';
```

### In production

A request goes to the server functions first, then to the client files, then to the routes:

```ts
// server.prod.ts
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import path from 'node:path';
import { toNodeHandler } from 'srvx/node';

const client = path.resolve('dist/client');
const server = await import(path.resolve('dist/server/server.js'));

const render = toNodeHandler(async (request: Request) => {
  // Server function calls.
  if (request.method === 'POST') {
    const answer = await server.handle(request);
    if (answer) {
      return answer;
    }
  }
  // Pages, streamed.
  return (await server.route(request)) ?? new Response('Not found', { status: 404 });
}) as RequestListener;

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  // The built client files.
  if (pathname.startsWith('/assets/')) {
    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    response.end(await readFile(path.join(client, path.normalize(pathname))));
    return;
  }
  await render(request, response);
}).listen(3000);
```

`server.prod.ts` of `examples/todos` also sets content types, refuses paths outside `dist/client` and sends early hints.

- `route` adds the script tag of the client entry, read from the manifest at build time. The server reads no manifest.
- `route` returns `undefined` when no route matches and there is no root `_error.brm`. The server answers with a 404 then.
- `toNodeHandler` writes each `set-cookie` header apart, so the browser keeps every cookie.
- Pass the address of the client as `address`, such as `request.ip` of srvx, for rate limits. See [Rate limiting](./security.md#rate-limiting).
- Files under `/assets/` have hashes in their names, so they can be cached for a long time.

### The script tags

`handle` of `virtual:brumate/routes` writes the script tags of each page when its options have no `scripts`. In development, they are the Vite client and `virtual:brumate/start`. In a build, the tag is the client entry, with `async`, so it starts while `#loading` content still streams. An explicit `scripts` replaces the default tags, and is written as given. Pass `''` for pages that load no client code, or your own tags, such as an entry other than the one in the manifest. Your own tags in development list the Vite client too. Under a nonce policy, pass `nonce` instead of writing the tags: the default tags carry it.

## Early hints

The client build writes the URLs of the loader and the core, which every page loads, to `.brumate/hints.json` in its output. The routes of the server build read it, so a page gets them three ways:

- A `<link rel="modulepreload">` for each at the start of its head, so the browser loads the core with the HTML.
- `Link` headers with the same URLs. Hosts such as Cloudflare turn them into `103 Early Hints` for the next visits.
- `earlyHints`, a callback that receives the `Link` values before the page renders. Node's `writeEarlyHints` sends them as a `103` response at once, so the browser loads the modules while the server renders.

On Node, under Nitro or `toNodeHandler`, the request reaches the Node response:

```ts
const answer = await handle(request, {
  earlyHints: (link) => request.runtime?.node?.res?.writeEarlyHints({ link }),
});
```

Client navigation and requests for `#defer` bodies get none, since the page has the modules already. Development has none. With a client build in another folder, set `clientOutDir` in the plugin options, or pass `hints` to `route` yourself.

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
- `renderToStream` adds no script tags of its own, so pass the tag of the client entry in `scripts`.
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

Pages without data, such as documentation or an about page, can be written to static files at build time:

```ts
brumate({ prerender: { paths: ['/about', '/docs'] } });
```

- Each path renders to an `index.html` in a folder of its path.
- Links on a rendered page lead to more pages, which render too. `crawl: false` renders only the listed paths.
- The root `_error.brm` renders as `404.html`, which most static hosts show for a missing page.
- Pages that answer with another status, or with a redirect, are not written. Endpoints are not written either.
- Client navigation and layouts that keep their state work on a static host too.
- The build writes the hashes of the inline scripts to `.brumate/prerender.json`, for a Content Security Policy. See [Content Security Policy for prerendered pages](#content-security-policy-for-prerendered-pages).

[Plugin options](./reference-plugin.md#prerenderoptions) lists every prerender option.

### Under Nitro

`vite build` prerenders after the server environment, in the same build:

- The routes must build in their own server environment, so the server entry, `src/entry-server.ts`, imports `virtual:brumate/routes`.
- Plain pages go to `.output/public` as files. Nitro serves a file there before the entry sees the request, so these pages get no headers and no nonce from the entry.
- A page with a `#defer` block goes to Nitro's server assets, not to `.output/public`. `handle` reads it and sends it as the shell, then the `#defer` bodies in the same response. The entry needs no code for it. See [`#defer` on prerendered pages](#defer-on-prerendered-pages).
- `prerender.client` is not needed. The pages go to the output of the client environment, or to `clientOutDir`.

brumate prerenders the pages itself, not with Nitro's `prerender`. Nitro's builds the app a second time, and writes no `404.html`, no shells and no `.brumate/prerender.json`.

### With two builds

With [a server of your own](#a-server-of-your-own), the pages render after the `--ssr` build:

```bash
vite build --outDir dist/client
vite build --ssr src/server.ts --outDir dist/server
```

Every page goes to `dist/client`, also a page with a `#defer` block. Upload `dist/client` to a static host, or serve its files from the server.

### `#defer` on prerendered pages

The body of a [`#defer`](./async-data.md#defer) block renders on the server, also on a prerendered page, such as a line that names the user who is signed in. A page with such a body is prerendered as a shell, or stays out of `paths`.

Under Nitro, `handle` passes the shell itself. A server of your own that has the prerendered file passes it to the routes as `shell`:

```ts
const html = await readFile(path.join('dist/client', url.pathname, 'index.html'), 'utf8').catch(
  () => undefined,
);
const answer = await route(request, html === undefined ? {} : { shell: html });
```

- The routes send the shell at once, then the body of each `#defer` block with the `load` or `idle` trigger, in the same response, as a `#loading` body streams. The browser does not ask for them.
- Each body renders in a request of its own, so middleware runs for it, and it can read the user. The response is `private, no-cache`.
- A `visible` block, and a block whose body fails, keep their fallback until the browser asks, as on a page without a shell.
- The request for a `#defer` body, with the header `x-brumate-defer`, and client navigation render the route as usual, whatever `shell` is.
- A static host without a server answers with the file. The browser asks for each body when its trigger fires, and without a server the block keeps its fallback.

### Content Security Policy for prerendered pages

A prerendered file is rendered once, so its inline scripts have no nonce. The build writes the SHA-256 hashes of each page's inline scripts to `.brumate/prerender.json` in the client output, `.output/public` under Nitro:

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
- A page with `shell: true` is a shell in Nitro's server assets. `handle` gives its scripts the nonce of the request, so it needs no hashes.

Send a policy with the hashes:

```ts
import prerendered from './dist/client/.brumate/prerender.json' with { type: 'json' };

const hashes = prerendered.scripts.map((hash) => `'${hash}'`).join(' ');
const policy = `script-src 'self' ${hashes}`;
```

`'self'` allows the client entry, which a file loads with no nonce. Use the hashes of every page in one policy. The client router keeps the policy of the page that the browser loaded, and runs the scripts of the next page under it. A policy that requires Trusted Types adds `trusted-types brumate`. See [Trusted Types](./reference-security.md#trusted-types).

Under Nitro, the entry does not see the request for a file in `.output/public`, so it cannot set the policy of that file. Set it where the files are served, such as in the header rules of the host.

A policy with hashes cannot cover a page that the server renders on each request. When a server of your own sends both kinds of pages, give the prerendered files a nonce as it sends them, and use the nonce policy for every page. A `shell` that the server passes is sent as given, so it needs the nonce too:

```ts
const html = (await readFile(file, 'utf8')).replaceAll('<script', `<script nonce="${nonce}"`);
```

## Skew protection

A resumable page lives long. A page that was open before a deploy can load code after it, such as the code of a component that a block renders, and calls server functions that the new build may have changed. Skew protection keeps such a page working, or loads it again:

- Each build has an ID. The client build writes it to `.brumate/build.json` in its output, and the server build reads it, so build the client first. A Nitro build does this in one `vite build`. `BRUMATE_BUILD` in the environment names the ID for both builds, such as the commit in CI.
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

## Checklist

- Build the client before the server. `vite build` does it under Nitro.
- Write no script tags. `handle` adds them, and passes `nonce` on to them.
- On a server of your own, serve `dist/client/assets` with long cache headers. Nitro does this itself.
- Send server function calls, `POST` requests to `/_brumate/…` by default, to `handle`.
- Set `origins` in the plugin options if pages on another origin of yours call server functions. See [Security](./reference-security.md).
- Check what each route ships with `report: true` or a `budget`. See [Inspect](./inspect.md).
