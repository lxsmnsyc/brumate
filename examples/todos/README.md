# Todos example

A todo list, a counter, a guestbook and a quote that streams in, rendered on the server and resumed in the browser.

- `src/App.brm`: the todo list, a `$memo` count, and a quote that a `#loading` block streams in.
- `src/routes`: a layout with an `@aside` slot, a dynamic route (`/counter/[start]`), a form with `$action` (`/guestbook`), an endpoint (`/api/hello`), an error page and a catch-all 404.
- `src/store.ts`: a file of server functions.

For a larger app with sign-in, middleware, validation and optimistic updates, see [`examples/tracker`](../tracker).

## Development

```bash
pnpm --filter brumate build
pnpm --filter example-todos dev
```

`server.ts` renders the page with Vite in development. Vite serves the client modules and answers server function calls.

## Production

```bash
pnpm --filter brumate build
pnpm --filter example-todos build
pnpm --filter example-todos start
```

`build` writes two builds:

- `dist/client`: the client entry, `src/client.ts`, and a chunk for each component entry and part. `.vite/manifest.json` gives the file of the client entry.
- `dist/server`: `src/server.ts`, which exports `handle` for server function calls and `route` for pages.

`server.prod.ts` serves `dist/client/assets`, answers server function calls with `handle`, and streams every other page with `route`.

## What to look at

Open the page and the network panel:

- Until the `load` event, the page runs only the loader, the client entry. The quote streams in about 1.5 seconds later, and `load` waits for it.
- The code of the page loads with the HTML, as one bundle for each root component, so a click needs no request of its own.
- The first link that you follow loads the code of client navigation. The layout and its Wide button keep their state.

## Tests

```bash
pnpm --filter example-todos test
```

The tests in `test` render components on the server and resume them in happy-dom with `brumate/testing`.
