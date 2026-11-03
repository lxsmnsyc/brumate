---
id: server-on-error
title: onError in src/middleware.ts for errors of the server
status: done
priority: must
type: feature
outline: false
milestone: 0.6.0
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/server-on-error.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent: 232000
owns:
  - packages/brumate/test/server-on-error.test.ts
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/request.ts
  - packages/brumate/src/runtime/routes.ts
  - packages/brumate/src/vite.ts
  - website/docs/routing.md
  - website/docs/reference-routes.md
  - website/docs/server-functions.md
reserves: []
provides: []
depends_on: []
---

# onError in src/middleware.ts for errors of the server

## Goal

`src/middleware.ts` can export `onError(error, info)`, next to its default middleware. The server calls it with every error it logs today, so an app can send the errors of the server to a service such as Sentry. Today the server calls `console.error` itself, and nothing in the app sees the error: middleware gets the 500 response of `_error.brm`, not the error, and an error after the response starts never reaches it.

```ts
// src/middleware.ts
import { defineMiddleware, type ServerErrorInfo } from 'brumate/server';

export default defineMiddleware((event, next) => next());

export function onError(error: unknown, info: ServerErrorInfo): void {
  report(error, { path: new URL(info.event.request.url).pathname, kind: info.kind });
}
```

## Context

- The maintainer asked for it on 2026-11-03, on `src/middleware.ts`, after a check found no server error hook. The browser has one already: `start({ onError })` (reference-server.md:182).
- The server logs in `errorAnswer` and `safeError` (server.ts, near "The message and status that answer an error"), and with `console.error` at about 9 places in server.ts and request.ts:223. Each place that logs an error that is not a `ServerError` calls the hook.
- A `ServerError` is an answer, not a failure: it does not reach `onError`, as it is not logged today.
- `safeError` logs a failure once even when two places read it (`logged`). The hook follows the same rule: one call per error object.
- The plugin finds the entry middleware with `middlewareFile()` in vite.ts. The server entries that import its default import `onError` too, when the file exports it. The testing module (`virtual:brumate/testing`) passes it to `visit`, so a test can see the errors of a page.
- `info` holds `event`, the `RequestEvent` of the request when there is one, and `kind`: `'page'`, `'endpoint'`, `'call'`, `'defer'`, or `'stream'` for an error in a `#loading` body or a route after the response started.
- Choices made here, so the worker does not ask:
  - With `onError`, the server does not also call `console.error`. The app logs what it wants.
  - A hook that throws, or returns a promise that rejects, has its error and the first one logged with `console.error`, and the request goes on as before.
  - The hook runs in development too. `errorPage` on the dev server is unchanged.
- Check the name and shape against `docs/proposals.md` (Observability) before writing code, so a later `onTrace` fits beside it.

## Acceptance

- [ ] `onError` exported from `src/middleware.ts` gets each error that is not a `ServerError` of: a page render (before `_error.brm` renders), an endpoint, a server function call, a form post, a `#defer` body, and a `#loading` body that fails after the response started. A test covers each kind.
- [ ] A `ServerError` does not reach it. An error read in two places reaches it once.
- [ ] With `onError`, nothing is logged for those errors. A hook that throws logs both errors, and the response is the same as without the hook.
- [ ] `_error.brm`, the statuses and the messages that reach the browser do not change.
- [ ] `ServerErrorInfo` is exported from `brumate/server`. routing.md (Middleware, Errors and 404), reference-routes.md and server-functions.md (Errors) document the hook.
- [ ] No change in the client: todos gzip JS before `load` stays at 13.6 kB (`pnpm bench --only brumate --scenario todos`).
- [ ] A minor changeset for brumate.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one hook through every logging place of the server, the plugin wiring, six kinds of tests and three docs pages.
