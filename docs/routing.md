# Routing

Routes are `.brm` files under `src/routes`. The path of a file is the URL that it renders. A layout wraps the routes of its folder, and sibling routes render in named slots of a layout for the same URL.

## Files

| File or folder        | What it is                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| `index.brm`           | The page of its folder, such as `/` for `src/routes/index.brm`.                |
| `about.brm`, `about/` | A fixed segment: `/about`.                                                     |
| `[id].brm`, `[id]/`   | A dynamic segment. The page reads it as `params.id`.                           |
| `[...rest].brm`       | The rest of the path, such as `a/b`. The page reads it as `params.rest`.       |
| `_layout.brm`         | Wraps every route of its folder and the folders inside it.                     |
| `@aside/`             | A sibling route tree. It matches the same URL and renders in the `aside` slot. |
| `@aside/_default.brm` | What the `aside` slot renders when its routes do not match the URL.            |

Other files that start with `_` are not routes.

A fixed segment wins over a dynamic one, and a dynamic one wins over `[...rest]`. A folder can have only one dynamic segment.

## Layouts and slots

A layout gets the matched route as `children`, one prop for each `@` folder next to it, and `params`.

```html
<!-- src/routes/_layout.brm -->
<script>
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
  import { setStatus } from 'brumate/server';

  const { params } = $props();
  setStatus(404);
</script>

<h1>No page at /{params.rest}</h1>
```

`handleRoute(tree, request, options)` and `matchRoute(tree, pathname)` from `brumate/server` do the same with a tree built by hand.

## Navigation

Links are plain `<a>` elements, and each one loads a full page. Each page resumes with only the loader, so no router code ships to the browser. Navigation on the client is not supported yet.

[`examples/todos`](../examples/todos) has a layout, three routes, an `@aside` slot and a 404 page. The guestbook route has a form that posts to a server function.
