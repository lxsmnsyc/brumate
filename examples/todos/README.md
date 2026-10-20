# Todos example

A todo list, a counter and a quote that streams in, rendered on the server and resumed in the browser.

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
- `dist/server`: `src/server.ts`, which exports the `App` component, `renderToStream`, and `handle` for server function calls.

`server.prod.ts` serves `dist/client/assets`, answers server function calls with `handle`, and streams every other page.

Open the page and the network panel. Only the loader runs before the first click. The first click loads `brumate/client` and the parts of the component that was clicked.
