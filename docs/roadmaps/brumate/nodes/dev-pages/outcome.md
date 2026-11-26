# Outcome: dev-pages

## Built

- `packages/brumate/src/vite.ts`: `configureServer` returns a post hook that installs a middleware. It runs after Vite's middlewares and after the plugin's own endpoints (RPC, source, workbench), so Vite files and server function calls never reach it.
- The middleware imports `virtual:brumate/routes` through `server.environments.ssr.runner`, calls `handle(request, { address })` for every method, and calls `next()` only when `handle` returns undefined.
- Node bridge, private to the plugin (no new dependency): `toWebRequest` (URL from `req.url` and `Host`, `https` when the socket is encrypted, array headers appended, HTTP/2 pseudo headers skipped, streamed body with `duplex: 'half'` for every method except GET and HEAD, signal aborts when the client leaves) and `sendWebResponse` (`toNodeHeaders` keeps each `set-cookie`, `pipeline` cancels the stream when the client leaves and destroys the response when the stream fails, HEAD cancels the body).
- Skipped with `server.middlewareMode`, with `server.environments.nitro`, and with an `appType` other than `custom`. For the last, a warning is logged once per plugin instance.
- The `config` hook sets `appType: 'custom'` for `vite dev` when the user left it unset. Preview is not changed.
- A throw answers 500 with `errorPage(error, server)` after `ssrFixStacktrace`. When headers were sent, the error is logged and the response destroyed.
- Tests: `packages/brumate/test/dev-pages/dev-pages.test.ts`. Changeset: `.changeset/dev-pages.md` (minor).

## Deviations

- The request URL comes from `req.url`, not `originalUrl` as the brief says (idlip's way). Vite strips `base` from `req.url`, and the routes have no base handling, so `originalUrl` made every page under a `base` answer 404.
- A client that leaves mid-stream (`ERR_STREAM_PREMATURE_CLOSE`) is not logged. Other stream errors are logged and destroy the response.
- `writeHead` gets no reason phrase when `statusText` is empty.
- The bridge lives in `vite.ts`, not a new file, to stay inside the owned and shared paths.
- `dev-error.ts` is unchanged: `errorPage` already fixes the stack trace and logs.
- The `middlewareMode` test checks that a request through `dev.middlewares` is not answered, and that the server is not served by a listening socket.

## Gotchas

- The `config` hook now sets `appType: 'custom'` for any `vite` serve run with the plugin, including Vitest. Vite's SPA fallback no longer applies to apps with a root `index.html`, unless the user sets `appType`.
- Under a root `_error.brm`, unknown paths render the 404 page instead of reaching Vite's 404.
- A request through the middleware is not recorded for the dock timeline, unlike server function calls.
- For client-scripts-docs: document the `appType` default and the three skip conditions. An app needs no `server.ts` in development, but production still does.

## Verification

- `pnpm lint`: no errors (warnings only, existing). `pnpm format:check`: pass. Root `pnpm typecheck`: pass.
- Review fixes: `test/dev-pages` has 18 tests (RPC call, form post status and location, chunks, HEAD, set-cookie, Host, abort signal, stream error, base).
- `pnpm --filter brumate exec vitest run test/dev-pages test/dev-setup test/dev-error test/default-scripts test/routes test/vite.test.ts test/dev-setup-twice`: 97 passed.
- Not run: full suite, e2e.

## Size

- Estimated M, actual M.
- Risk estimated medium, measured medium: the `appType` default changes every dev server that uses the plugin.
