---
id: default-scripts
title: handle defaults scripts in dev and production
status: done
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
verify: pnpm --filter brumate exec vitest run test/default-scripts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent: 332135
owns:
  - packages/brumate/test/default-scripts/**
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/routes.ts
  - packages/brumate/src/prerender.ts
  - packages/brumate/src/runtime/server.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# handle defaults scripts in dev and production

## Goal

When the caller passes no `scripts` to `handle` (or `route`), `virtual:brumate/routes` supplies them. Debate claims P1, P2, P9, O1, O5, O6 ([debate](../../../../debates/vite-client-scripts/debate.md)).

- **Dev** (`vite dev`, own server in `middlewareMode`, Nitro dev): `<script type="module" src="/@vite/client"></script>` plus the loader of the generated start module, `/@id/__x00__virtual:brumate/start`. The preview page builds the same pair today (`vite.ts:1665`). Make the start URL one shared constant used by both (O5).
- **Production**: the SSR build reads the client manifest in `buildStart`, as it already reads the build ID and hints (`vite.ts:2273-2290`), and bakes `<script type="module" async src="BASE + file">` into the routes module. `prerender.ts:109` builds the same tag; share the code. Take the manifest path from the resolved client environment's `outDir`, not a fixed `dist/client`, so Nitro's `.output/public` works.
- A missing client manifest or entry in the SSR build is `this.error` with a message that says to build the client first (O1). Today only a warning.
- A build-ID mismatch between the baked entry and `readBuildId` reuses the existing skew warning (O6).
- An explicit `scripts`, including `''`, still wins.
- The choice between dev and production is made by the plugin when it generates the module (its `isServe` and `isSsrBuild`), not by `import.meta.env` at runtime. The routes module is generated in `load` (`vite.ts:2462`, `routeTree`) for every environment, Nitro's included (debate O4 ruling).

## Current state

`routeTree()` generates `virtual:brumate/routes`; `handleRoute` (`runtime/server.ts:4482`) and `firstRender` (`runtime/server.ts:3360`) read `options.scripts` and append it after the page state. Every example and doc passes `scripts` by hand (debate J3).

## Acceptance

- [ ] Under `vite dev` with `middlewareMode`, `handle(request)` with no `scripts` streams a page whose tail has `/@vite/client` and the start module.
- [ ] After `vite build` and `vite build --ssr`, `handle(request)` with no `scripts` names the hashed client entry; an explicit `scripts: ''` names nothing.
- [ ] An SSR build with no client build fails with the error message.
- [ ] The preview page and the default use one constant for the start URL.
- [ ] A minor changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: one generated-module change, one build-time manifest read, tests for both modes.
