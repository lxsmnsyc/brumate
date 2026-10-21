# Routing

Routes are `.brm` files under `src/routes`. The path of a file is the URL that it renders. A layout wraps the routes of its folder, and sibling routes render in named slots of a layout for the same URL.

## Files

| File or folder         | What it is                                                                        |
| ---------------------- | --------------------------------------------------------------------------------- |
| `index.brm`            | The page of its folder, such as `/` for `src/routes/index.brm`.                   |
| `about.brm`, `about/`  | A fixed segment: `/about`.                                                        |
| `[id].brm`, `[id]/`    | A dynamic segment. The page reads it as `params.id`.                              |
| `[...rest].brm`        | The rest of the path, such as `a/b`. The page reads it as `params.rest`.          |
| `_layout.brm`          | Wraps every route of its folder and the folders inside it.                        |
| `@aside/`              | A sibling route tree. It matches the same URL and renders in the `aside` slot.    |
| `@aside/_default.brm`  | What the `aside` slot renders when its routes do not match the URL.               |
| `_error.brm`           | Renders when a route of its folder throws, or at the root, when no route matches. |
| `_loading.brm`         | Shows while a route of its folder streams in.                                     |
| `_middleware.ts`       | Runs before the routes of its folder and the folders inside it.                   |
| `hello.ts`, `index.ts` | An endpoint: answers requests at its path with the handlers that it exports.      |

Other files that start with `_` are not routes.

A fixed segment wins over a dynamic one, and a dynamic one wins over `[...rest]`. A folder can have only one dynamic segment.

## Layouts and slots

A layout gets the matched route as `children`, one prop for each `@` folder next to it, and `params`.

```html
<!-- src/routes/_layout.brm -->
<script>
  import { $props } from 'brumate/signals';

  const { children, aside } = $props();
</script>

<html>
  <body>
    <main>{children}</main>
    <aside>{aside}</aside>
  </body>
</html>
```

For `/counter/10`, with these files:

```
src/routes/_layout.brm
src/routes/index.brm
src/routes/counter/[start].brm
src/routes/@aside/_default.brm
src/routes/@aside/counter/[start].brm
```

- `children` renders `counter/[start].brm`.
- `aside` renders `@aside/counter/[start].brm`.
- Both get `params.start`, which is `'10'`.

For `/`, `aside` renders `@aside/_default.brm`, because `@aside` has no `index.brm`. A slot with no match and no `_default.brm` is undefined, so it renders nothing.

A layout renders before its children and slots, and they render where the layout inserts them. So a context that a layout provides with `$provide` reaches the routes inside it.

A route can render the whole document, as the root layout above does. `renderToStream` then adds the doctype, the head and the scripts.

## Errors

`_error.brm` renders in place of a route of its folder that throws while its page renders. It gets `error`, with `message` and `status`:

```html
<!-- src/routes/_error.brm -->
<script>
  import { $props } from 'brumate/signals';

  const { error } = $props<{ error: { message: string; status: number } }>();
</script>

<h1>Error {error.status}</h1>
<p>{error.message}</p>
```

- The nearest `_error.brm` of the route renders, inside the layouts of its folder and the folders above it.
- A `ServerError` gives its message and status. Any other error gives status 500 and a generic message, and is logged on the server.
- An error file that throws hands the error to the next one outside it.
- A path that no route matches renders the `_error.brm` of the root, with status 404.
- An error in a `#loading` body that streams in later keeps its fallback, because the page has been sent.

## Loading

`_loading.brm` shows while a route of its folder streams in. The layouts render first, and the route follows when it is ready, as the body of a `#loading` block does.

```html
<!-- src/routes/reports/_loading.brm -->
<p>Loading the report…</p>
```

## Endpoints

A `.ts` file answers requests at its path. It exports a handler for each method, which gets the request and the params:

```ts
// src/routes/api/todos/[id].ts
export async function GET(request: Request, params: Record<string, string>): Promise<Response> {
  return Response.json(await db.todos.get(params.id));
}
```

- A method that the file does not export answers 405, with `Allow`. `HEAD` uses `GET`.
- A folder can have a page and an endpoint at the same path. The endpoint answers the methods that it exports, and the page answers `GET` otherwise.
- Endpoints do not check where a call comes from. `isCrossSite` from `brumate/server` does, for a handler that changes data.

## Middleware

`_middleware.ts` runs before every route of its folder, endpoints included. It exports `middleware`, which answers the request itself, or calls `next` for the answer of the route:

```ts
// src/routes/admin/_middleware.ts
export async function middleware(request: Request, next: () => Promise<Response>) {
  if (!(await session(request))) {
    return Response.redirect(new URL('/login', request.url));
  }
  return next();
}
```

The middleware of each folder on the path runs from the outside in.

## Serving routes

`virtual:brumate/routes` exports `routes`, the matched tree, and `handle(request, options)`. `handle` streams the page for the path of the request, or returns undefined when no route matches. It takes the options of `renderToStream`, such as `scripts`.

```ts
const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
const response = await handle(request, {
  scripts: '<script type="module" async src="/src/client.ts"></script>',
});
if (!response) {
  // No route matches. Answer with a 404.
}
```

The response has the headers and the status that were set while the page rendered. A `redirect` while it renders answers with a redirect. A catch-all page can answer with a 404:

```html
<!-- src/routes/[...rest].brm -->
<script>
  import { $props } from 'brumate/signals';
  import { setStatus } from 'brumate/server';

  const { params } = $props();
  setStatus(404);
</script>

<h1>No page at /{params.rest}</h1>
```

`handleRoute(tree, request, options)` and `matchRoute(tree, pathname)` from `brumate/server` do the same with a tree built by hand.

## Links

`href` from `brumate/routes` writes the URL of a route from its path in the route files, and TypeScript checks both:

```html
<script>
  import { href } from 'brumate/routes';
</script>

<a href=(href('/todos/[id]', { id: todo.id }))>{todo.title}</a>
```

- A path that no route has, or a missing param, is a type error in the editor and in `brumate-tsc`.
- Params are encoded. A rest param, such as `[...path]`, keeps its slashes.
- `RouteParams<'/todos/[id]'>` is the type of the params of a route, such as for the props of its page.
- The plugin writes the paths into `src/brumate-routes.d.ts` when routes are added or removed. The `routeTypes` option moves it, and `false` turns it off. Commit the file, so type-checking works before a build.

## Navigation

Links are plain `<a>` elements. Without scripts, each one loads a full page. Once the loader runs, it loads pages itself:

- A click on a link to the same origin fetches the page. The back and forward buttons do too.
- The first render of the new page replaces the document as soon as it arrives. Markup that streams after it, such as `#loading` bodies, follows as it arrives.
- The head is updated. Elements that are in both pages stay.
- The core forgets the state of the old page and reads the state of the new one. Modules that are already loaded are not loaded again.
- A form that posts to a server function is sent with `fetch`. The page that the server redirects to replaces the current one, and the place on the page is kept when it is the same page.

The code for this is a separate module of about 2 KB. The loader imports it on the first navigation.

A page starts to load when the pointer rests on its link for 80 ms, or when the link gets focus. A click within 10 seconds uses that response, so the page arrives sooner. `data-prefetch="none"` on a link turns it off.

A link is left to the browser when it has `target`, `download` or `data-reload`, when a key such as Ctrl is held, or when it only changes the hash. `navigate: false` in the plugin options turns navigation off.

### View transitions

`navigate: { transition: true }` in the plugin options swaps each page inside a view transition, where the browser has them. By default the browser fades the old page into the new one. CSS changes the animation:

```css
/* The back and forward buttons slide the page instead. */
html:active-view-transition-type(traverse) {
  &::view-transition-old(root) {
    animation: slide-out 0.2s;
  }
  &::view-transition-new(root) {
    animation: slide-in 0.2s;
  }
}
```

- The type of a transition tells how the page was reached: `push` for a link, `traverse` for the back and forward buttons, and `form` for a form.
- An element with a `view-transition-name` moves on its own, such as a header that stays in its place.
- Without view transitions in the browser, the page swaps at once.

### Layouts stay

A link keeps the layouts that are the same on both pages, with their markup and their state on the client. Only the routes inside them are replaced.

- A layout is the same when it is the same file with the same params. A layout of `todos/[id]` changes when `id` changes. The root layout never changes.
- The server renders the whole page, and the client takes only the routes that changed. Comments in the page mark each slot: `<!--R…-->` and `<!--/R-->`.
- The new routes read contexts from the kept layouts on the client. Their first render shows the values that the server rendered.
- The server starts the IDs of the new page above the IDs of the page in the browser, so the two never mix. The request sends that number in `x-brumate-base`.
- A page that does not start its IDs there, such as a prerendered file on a static host, has its IDs moved by the client before it is read: in its markers, its anchors, its swap scripts and its state. Layouts stay on static hosts too.
- A form replaces the whole page, because what it changed can show anywhere on it.
- Portals of the new routes are not added yet.

[`examples/todos`](../examples/todos) has a layout, three routes, an `@aside` slot and a 404 page. The guestbook route has a form that posts to a server function.
