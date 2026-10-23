# Routing

Routes are `.brm` files under `src/routes`. The path of a file is the URL that it renders, and a `_layout.brm` wraps the routes of its folder.

## Route files

A small blog could have these files:

```
src/routes/
├── _layout.brm            the document around every page
├── index.brm              /
├── about.brm              /about
├── posts/
│   ├── index.brm          /posts
│   ├── [slug].brm         /posts/hello-world
│   └── _loading.brm       shows while a post loads
├── docs/
│   └── [...path].brm      /docs/guide/install, and any depth below /docs
├── @aside/
│   ├── _default.brm       the sidebar of every other page
│   └── posts/[slug].brm   the sidebar of a post
├── api/
│   └── posts.ts           an endpoint: GET /api/posts
├── admin/
│   └── _middleware.ts     runs before every route under /admin
├── _error.brm             errors, and paths that match no route
└── [...rest].brm          a page for every path that nothing else matches
```

- `index.brm` is the page of its folder.
- `[name]` matches one segment. `[...name]` matches the rest of the path.
- A fixed segment wins over `[name]`, and `[name]` wins over `[...name]`.
- Files that start with `_` are not pages, except the special files above.

[Route files](./reference-routes.md) lists every file and what it does.

## Params

A page gets the dynamic segments of its path as `params`. `RouteParams` from `brumate/routes` gives their type:

```brm
<!-- src/routes/posts/[slug].brm -->
<script>
  import type { RouteParams } from 'brumate/routes';
  import { $memo, $props } from 'brumate/signals';
  import { db } from '../../db.ts';

  const { params } = $props<{ params: RouteParams<'/posts/[slug]'> }>();

  async function getPost(slug: string) {
    'use server';
    return db.posts.find(slug);
  }

  const post = $memo(getPost(params.slug));
</script>

<h1>{post.title}</h1>
<p>{post.body}</p>
```

- Every param is a string. Convert it yourself, such as with `Number(params.id)`.
- A `[...path]` param holds the rest of the path with its slashes, such as `guide/install`.
- The query string is in `$route().search`. See [The route](./navigation.md#the-route).

## Layouts

A `_layout.brm` wraps every route of its folder and of the folders inside it. It gets the matched route as `children`, and inserts it where the route should go:

```brm
<!-- src/routes/_layout.brm -->
<script>
  import { $props } from 'brumate/signals';

  const { children } = $props();
</script>

<html lang="en">
  <head>
    <meta charset="utf-8">
  </head>
  <body>
    <nav><a href="/">Home</a> <a href="/posts">Posts</a></nav>
    <main>{children}</main>
  </body>
</html>
```

- The root layout usually renders the whole document. The server adds the doctype, the head of the components and the scripts.
- Layouts nest. `posts/_layout.brm` renders inside the root layout, around the pages of `/posts`.
- A layout gets `params` too.
- A context that a layout provides with `$setContext` reaches every route inside it. See [Context](./context.md).
- When a link leads to another page with the same layout, the layout stays in the browser with its state. See [Navigation](./navigation.md#layouts-keep-their-state).

## Named slots

A folder that starts with `@` is a second route tree for the same URLs. Its match renders in a slot of the layout next to it, named after the folder:

```brm
<!-- src/routes/_layout.brm -->
<script>
  import { $props } from 'brumate/signals';

  const { children, aside } = $props();
</script>

<main>{children}</main>
<aside>{aside}</aside>
```

For `/posts/hello-world`, with the files above:

- `children` renders `posts/[slug].brm`.
- `aside` renders `@aside/posts/[slug].brm`.
- Both get `params.slug`, which is `'hello-world'`.

For `/about`, `@aside` has no match, so `aside` renders `@aside/_default.brm`. A slot with no match and no `_default.brm` renders nothing.

## Errors and 404

`_error.brm` renders in place of a route of its folder that throws. It gets `error`, with a `message` and a `status`:

```brm
<!-- src/routes/_error.brm -->
<script>
  import { $props } from 'brumate/signals';

  const { error } = $props<{ error: { message: string; status: number } }>();
</script>

#head {
  <title>{`Error ${error.status}`}</title>
}

<h1>Something went wrong</h1>
<p>{error.status}: {error.message}</p>
```

- The nearest `_error.brm` renders, inside the layouts above it.
- A `ServerError` from `brumate/server` gives its message and status. Any other error gives status 500 and a generic message, and the server logs it.
- A path that no route matches renders the `_error.brm` of the root, with status 404.
- An error file that throws hands the error to the next one outside it.

A catch-all page can answer with a 404 status itself, with `setStatus` on the event of the page:

```brm
<!-- src/routes/[...rest].brm -->
<script>
  import { $props } from 'brumate/signals';
  import { getEvent } from 'brumate/server';

  const { params } = $props<{ params: { rest: string } }>();
  getEvent().setStatus(404);
</script>

<h1>No page at /{params.rest}</h1>
```

`setStatus` works in the script of a component while the first part of the page renders. Content that streams in later, such as a `#loading` body, cannot change the status, because the response has started.

## Loading

`_loading.brm` shows while a route of its folder loads. The layouts render first, and the route streams in when it is ready:

```brm
<!-- src/routes/posts/_loading.brm -->
<p>Loading the post…</p>
```

This works like a `#loading` block around the route. See [Async data](./async-data.md).

## Endpoints

A `.ts` file in the routes answers requests at its path. It exports a function for each HTTP method, which gets the request and the params and returns a `Response`:

```ts
// src/routes/api/posts/[slug].ts
import { db } from '../../../db.ts';

export async function GET(request: Request, params: Record<string, string>): Promise<Response> {
  return Response.json(await db.posts.find(params.slug));
}

export async function DELETE(request: Request, params: Record<string, string>): Promise<Response> {
  await db.posts.remove(params.slug);
  return new Response(null, { status: 204 });
}
```

- A method that the file does not export answers 405. `HEAD` uses `GET`.
- A folder can have a page and an endpoint at the same path. The endpoint answers the methods that it exports, and the page answers `GET` otherwise.
- An endpoint does not check where a request comes from. For one that changes data, use `isCrossSite` from `brumate/server`. See [Security](./reference-security.md).

## Middleware

`src/middleware.ts` runs for every request of the app: pages, endpoints, server function calls, form posts and the requests for `#defer` bodies. It exports the middleware as its default, written with `defineMiddleware` for its types:

```ts
// src/middleware.ts
import { defineMiddleware } from 'brumate/server';
import { session } from './session.ts';

export default defineMiddleware(async (event, next) => {
  event.locals.user = await session.get(event);
  if (event.kind === 'call' && event.call.id.includes('#admin') && !event.locals.user?.admin) {
    return new Response('Forbidden', { status: 403 });
  }
  return next();
});
```

- `event` is the `RequestEvent` of the request, the one that `getEvent()` returns. `event.kind` says what the request is for: `'page'`, `'endpoint'`, `'call'` for a server function call or a form post to one, or `'defer'` for the body of a `#defer` block.
- For a call, and for a form that posts to a page with `?__action=<id>`, `event.call` has the ID of the server function and its arguments, read already, so a check can depend on them.
- `event.locals` holds what the middleware finds, such as the user, for the components, server functions and endpoints of the request. See [Request locals](#request-locals).
- It runs first, before the `_middleware.ts` of the folders. A call from a page of another site is refused before it runs. See [Security](./reference-security.md).
- The `middleware` option of the plugin names another file. `false` runs none.

A `'use server'` file can export `middleware` too, with the same shape. It runs before each function of the file, after the middleware of the entry, for a group of functions with the same rule. The browser gets no stub for it.

`_middleware.ts` runs before every route of its folder and the folders inside it, endpoints included. It exports `middleware`, which answers the request itself, or calls `next` for the answer of the route:

```ts
// src/routes/admin/_middleware.ts
import { session } from '../../session.ts';

export async function middleware(request: Request, next: () => Promise<Response>) {
  if (!(await session(request))) {
    return Response.redirect(new URL('/login', request.url));
  }
  const response = await next();
  response.headers.set('cache-control', 'no-store');
  return response;
}
```

The middleware of each folder on the path runs from the outside in.

### Request locals

Middleware hands what it finds, such as the user, to the rest of the request through `event.locals`, as above. Components, server functions and endpoints read it with `getEvent().locals`:

```ts
async function listOrders() {
  'use server';
  const { user } = getEvent().locals;
  return user ? db.orders.of(user.id) : [];
}
```

Its type comes from the `Locals` interface of `brumate/server`, which the app adds to:

```ts
// src/locals.d.ts
declare module 'brumate/server' {
  interface Locals {
    user?: { id: string; name: string; admin: boolean };
  }
}
```

- It never goes to the browser. A component that sends a value from it, such as the user's name, reads the field it needs, as it does with any server value.

## Caching pages

A route exports `cache` from its module script to let a browser or a CDN keep the page:

```brm
<script module>
  export const cache = { maxAge: 60, staleWhileRevalidate: 600 };
</script>

<h1>About</h1>
#defer ('load') {
  <p>Signed in as {user}.</p>
}
```

- The server sends `cache-control: public, max-age=60, stale-while-revalidate=600`.
- A layout's `cache` applies to the pages below it. The nearest one wins.
- The page is public only when nothing in the request read who the user is. Reading cookies or the `authorization` header, or setting a cookie, makes it `private, no-cache`. Middleware counts too, such as middleware that reads the session for every request.
- Put what depends on the user in a `#defer` body. It renders in a request of its own, so the rest of the page stays public.
- A page with `cache` renders in full before its headers go out, so a `#loading` body that reads the user makes it private too. Such a page does not stream.
- Only `GET` and `HEAD` requests with status 200 are cached.
- The dev server sends `no-cache`, so pages change as you edit, and says what the page would get in `x-brumate-cache`. It warns when a page with `cache` turns out private.

## Links

Links are plain `<a>` elements. `href` from `brumate/routes` writes the URL of a route from its path in the route files, and TypeScript checks both:

```brm
<script>
  import { href } from 'brumate/routes';
</script>

<a href=(href('/posts/[slug]', { slug: post.slug }))>{post.title}</a>
```

- A path that no route has, or a missing param, is a type error in the editor and in `brumate-tsc`.
- Params are encoded. A `[...path]` param keeps its slashes.
- The Vite plugin writes the route paths into `src/brumate-routes.d.ts` when routes are added or removed. Commit this file, so type-checking works before a build.

## Serving routes

`virtual:brumate/routes` exports `handle(request, options)`, which answers a web `Request` with the page, endpoint or middleware answer for its path:

```ts
const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
const response = await handle(request, {
  scripts: '<script type="module" async src="/src/client.ts"></script>',
});
```

It returns `undefined` when no route matches and the app has no entry middleware, and the root has neither `_error.brm` nor `_middleware.ts`, so the server can answer with its own 404. [Deploying](./deploying.md) shows a full server for development and production.

[`examples/todos`](https://github.com/lxsmnsyc/brumate/tree/main/examples/todos) has a layout, an `@aside` slot, a dynamic route, an endpoint and a 404 page. [`examples/tracker`](https://github.com/lxsmnsyc/brumate/tree/main/examples/tracker) adds middleware that guards a page, a session, and a page prerendered next to dynamic ones.
