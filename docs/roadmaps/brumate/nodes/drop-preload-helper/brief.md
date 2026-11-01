---
id: drop-preload-helper
title: The client loader ships without Vite's preload helper
status: todo
priority: should
type: fix
outline: false
milestone: 0.4.1
target: main
from:
size: M
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-01
owns: []
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# The client loader ships without Vite's preload helper

## Goal

The loader chunk of a page no longer carries Vite's preload helper (`__vitePreload`, about 1.3 kB min, 0.68 kB gzip on todos). brumate already sends its own preload hints from `hints.json`, so the helper only repeats that work. The CSS of lazy bundles (`defer`, bundle imports) must still load before their markup shows.

## Context

- perf-pass-0.4 outcome, option D (nodes/perf-pass-0.4/outcome.md, "Where the bytes go" and the options table): the loader is 57% `boot` and 19% the helper. Removing it was simulated on the built chunk only: 3,143 -> 2,464 B gzip on todos. Not run in a browser.
- The plugin (packages/brumate/src/vite.ts) already returns no dependencies for the core and honors `build.modulePreload: false` (option C). Vite still emits the helper for `defer` and bundle imports.
- Look first for a supported switch (Vite or Rolldown option, `build.modulePreload.resolveDependencies`, a way to mark imports so Vite skips the wrapper). Fall back to a `renderChunk` rewrite of `__vitePreload(() => import(x), deps)` only if nothing else works, and keep it to the helper's known shapes with a test that fails when Vite changes them.
- If CSS of lazy bundles was preloaded only by the helper, brumate must preload it itself (from `hints.json`, or by its own small loader step), so no flash of unstyled content.
- Patch release: no new API, no new option the app must set. Behavior of apps stays the same apart from the smaller loader.
- Folding the loader into the core and dropping the core re-export stay in loader-preload-spike (0.5.0).

## Acceptance

- [ ] The built todos, dashboard and rows pages contain no `__vitePreload` (or Vite's preload helper under any name) in their client chunks.
- [ ] A `defer` block and a bundle import with their own CSS show styled on first paint, in a browser test (e2e or brumate/testing), on dev and on build.
- [ ] Dev mode works as before.
- [ ] `pnpm bench` todos client JS gzip is recorded against main; the gain is reported (expected about 0.6 kB).
- [ ] Patch changeset.

## Sizing

M: one plugin change plus CSS preload for lazy bundles and browser tests. If only a `renderChunk` rewrite works and it looks fragile, stop and report to the maintainer before building it.
