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

Links are plain `<a>` elements. Without scripts, each one loads a full page. Once the loader runs, it loads pages itself:

- A click on a link to the same origin fetches the page. The back and forward buttons do too.
- The first render of the new page replaces the document as soon as it arrives. Markup that streams after it, such as `#loading` bodies, follows as it arrives.
- The head is updated. Elements that are in both pages stay.
- The core forgets the state of the old page and reads the state of the new one. Modules that are already loaded are not loaded again.
- A form that posts to a server function is sent with `fetch`. The page that the server redirects to replaces the current one, and the place on the page is kept when it is the same page.

The code for this is a separate module of about 2 KB. The loader imports it on the first navigation.

A link is left to the browser when it has `target`, `download` or `data-reload`, when a key such as Ctrl is held, or when it only changes the hash. `navigate: false` in the plugin options turns navigation off.

### Layouts stay

A link keeps the layouts that are the same on both pages, with their markup and their state on the client. Only the routes inside them are replaced.

- A layout is the same when it is the same file with the same params. A layout of `todos/[id]` changes when `id` changes. The root layout never changes.
- The server renders the whole page, and the client takes only the routes that changed. Comments in the page mark each slot: `<!--R…-->` and `<!--/R-->`.
- The new routes read contexts from the kept layouts on the client. Their first render shows the values that the server rendered.
- The server starts the IDs of the new page above the IDs of the page in the browser, so the two never mix. The request sends that number in `x-brumate-base`.
- A page that does not start its IDs there, such as a prerendered file on a static host, replaces the whole page instead. Its layouts render again, and their state resets.
- A form replaces the whole page, because what it changed can show anywhere on it.
- Portals of the new routes are not added yet.

[`examples/todos`](../examples/todos) has a layout, three routes, an `@aside` slot and a 404 page. The guestbook route has a form that posts to a server function.
