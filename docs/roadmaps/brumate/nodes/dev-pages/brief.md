---
id: dev-pages
title: Plain vite dev serves pages
status: active
priority: 
type: feature
story: client-scripts
early: false
outline: false
milestone: 
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/dev-pages
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - packages/brumate/test/dev-pages/**
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/dev-error.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: default-scripts
    kind: hard
    why: both edit vite.ts and the middleware relies on the default scripts
---

# Plain vite dev serves pages

## Goal

`vite dev` with the brumate plugin serves the pages of `src/routes`, so an app needs no `server.ts` in development. Debate claims A2, P6, P7, P11, O8, O9, O11 ([debate](../../../../debates/vite-client-scripts/debate.md)).

- `configureServer` returns a post hook that adds a middleware. It runs after Vite's public, transform and static middlewares and after the plugin's own RPC middleware (`vite.ts:2759`), so Vite files and server function calls never reach it (debate round 3).
- The middleware imports `virtual:brumate/routes` through the SSR environment's runner (the RPC middleware already checks `isRunnableDevEnvironment`), turns the Node request into a `Request`, calls `handle` for every method and every Accept, and pipes the streamed `Response` to the Node response. It calls `next()` only when `handle` returns undefined.
- Skip it when `server.config.server.middlewareMode` is true (own servers) and when `server.environments.nitro` exists (Nitro owns requests; `nitro/dist/_build/vite.dev.mjs:76`).
- The plugin's `config` hook sets `appType: 'custom'` when the user left it unset, as SvelteKit does. Vite's SPA fallback otherwise rewrites `req.url` to `/index.html` first (vite `node.js:25115`). With a user-set `spa` or `mpa`, skip the middleware and warn once that brumate pages need `appType: 'custom'`.
- A throw answers 500 with `errorPage(error, server)` after `server.ssrFixStacktrace(error)`, and logs when headers were already sent, as the preview page does (`vite.ts:1680-1688`).
- Under a root `_error.brm`, `handle` never returns undefined, so unknown paths render the 404 page. That matches today's hand-written servers and is accepted (debate open risks).

The Node conversion is private to the plugin, with no new dependency (brumate-node was dropped 2026-11-25). Start from the examples' `node.ts` and fix what it misses, comparing idlip's dev bridge ([plugin.ts](https://github.com/lxsmnsyc/idlip/blob/16b6e3f/packages/idlip/src/vite/plugin.ts#L412-L460)): the URL from `originalUrl` and the `Host` header; header arrays joined; a streamed body (`duplex: 'half'`) for every method but GET and HEAD; the request's `signal` aborts when the client leaves; `toNodeHeaders` so each `set-cookie` stays its own header (idlip's `setHeader` loop keeps only the last); and `pipeline` so a client that leaves cancels the stream and a stream error destroys the response instead of crashing `vite`.

## Acceptance

- [ ] A fixture app with no server file: `vite dev` serves `/` streamed, a POST endpoint answers, a no-JS form post works, a server function call works, a public file and `/@vite/client` are served by Vite.
- [ ] With `middlewareMode: true` the middleware is not installed (no double answer); with Nitro's environment present it is not installed.
- [ ] With `appType: 'spa'` set by the user, a one-time warning and no middleware.
- [ ] A compile error in a route shows the Errors tab page, and the page reloads after the fix.
- [ ] A minor changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: one middleware and config hook in `vite.ts`, one fixture and its tests.
