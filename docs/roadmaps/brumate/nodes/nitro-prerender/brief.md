---
id: nitro-prerender
title: Prerendering works in a Nitro build
status: todo
priority: 
type: fix
story: client-scripts
early: false
outline: false
milestone: 
target:
ship: auto
land: auto
from:
size: M
risk: medium
spike: false
hypothesis:
verify: node e2e/run.mjs --only tracker
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent:
owns:
  - docs/roadmaps/brumate/nodes/nitro-prerender/**
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/prerender.ts
  - packages/brumate/test/prerender*
  - examples/tracker/**
  - e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: examples-glue
    kind: hard
    why: it moved tracker to Nitro, where its prerendered pages stopped being written
---

# Prerendering works in a Nitro build

## Goal

Found by examples-glue (2026-11-26). The plugin prerenders only for `vite build --ssr`, so in a Nitro build (one `vite build`, environments) it writes nothing. tracker's `/about`, `/team`, `/from` and `/titles` now render on each request, and the e2e step "#defer body waits for its stylesheet" was removed because it needs shell mode. Nitro is the recommended host (`docs/decisions.md`), so prerendering must work there.

## Context

- Find where the plugin starts prerendering (`vite.ts`, `prerender.ts`) and run it after the server environment of a Nitro build, writing into the directory Nitro serves (`.output/public`, from the client environment's outDir or `clientOutDir`), so Nitro serves the files as static assets.
- Check how Nitro's own prerender (`nitro.prerender` routes) relates. If Nitro can prerender brumate's routes by crawling, compare that with brumate's own, and use the one that keeps `shell` mode and the prerender options as documented. Say why in the outcome.
- Keep the two-step `vite build --ssr` path working as it does today.

## Acceptance

- [ ] `pnpm build` in tracker writes the prerendered pages, and the Nitro server serves them as files (no render on request).
- [ ] The e2e step "#defer body waits for its stylesheet" is back and passes, with the other tracker steps.
- [ ] A test of prerendering in an environment build next to the existing prerender tests; the two-step tests still pass.
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: a prerender hook for environment builds, its tests, and the tracker restore.
