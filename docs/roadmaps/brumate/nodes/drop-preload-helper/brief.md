---
id: drop-preload-helper
title: The client loader ships without Vite's preload helper
status: active
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
owns:
  - packages/brumate/test/preload-helper.test.ts
shared:
  - packages/brumate/src/vite.ts
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
- Website, measured 2026-11-01: the client entry (loaded by every page) is 112.8 kB raw / 28.2 kB gzip, of which Vite's `__vite__mapDeps` list is 21.5 kB raw and the preload wrappers with their dependency arrays in the bundle table about 32 kB raw. Without them the entry is 15.2 kB gzip (simulated on the built file), so the gain on a large app is about 13 kB gzip, not the 0.68 kB of todos.
- Also drop the identity entries of the `owners` table in vite.ts `manifest()`: 342 of the website's 468 entries map a root to itself. The lookup becomes `owners[id] ?? (bundles[id] && id)`. About 17.6 kB raw / 3.8 kB gzip on the website (audit 2026-11-01).
- Folding the loader into the core and dropping the core re-export stay in loader-preload-spike (0.5.0). Sending bundle URLs from the server, so both tables leave the entry, is bundle-urls-from-server (0.5.0).

## Acceptance

- [ ] The built todos, dashboard and rows pages contain no `__vitePreload` (or Vite's preload helper under any name) in their client chunks.
- [ ] A `defer` block and a bundle import with their own CSS show styled on first paint, in a browser test (e2e or brumate/testing), on dev and on build.
- [ ] Dev mode works as before.
- [ ] `owners` holds no entry that maps a root to itself.
- [ ] `pnpm bench` todos client JS gzip and the website entry chunk gzip are recorded against main (expected about -0.6 kB on todos, about -16 kB on the website entry).
- [ ] Patch changeset.

## Sizing

M: one plugin change plus CSS preload for lazy bundles and browser tests. If only a `renderChunk` rewrite works and it looks fragile, stop and report to the maintainer before building it.
