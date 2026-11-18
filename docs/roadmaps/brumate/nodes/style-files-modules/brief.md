---
id: style-files-modules
title: "Component CSS as Vite style modules in builds"
status: active
priority: must
type: feature
story: style-files
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent: 283000
owns: []
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/codegen/render.ts
  - packages/brumate/src/codegen/server.ts
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/test/styles.test.ts
  - packages/brumate/test/styles/**
reserves: []
provides: []
depends_on: []
---

> 2026-11-18: refined from the design in `../style-files-spike/outcome.md` after the maintainer's go on per-bundle CSS with a shared chunk. Read that outcome first; the prototype is the local branch `spike/style-files` (078616fe).

# Component CSS as Vite style modules in builds

## Goal

In a build, each component with CSS gets a `?brumate-style&lang.css` module that returns its scoped CSS (`load` in `vite.ts`, skipped by `transform`), so Vite's CSS pipeline handles it, as vite-plugin-svelte and @vitejs/plugin-vue do. The client bundle of each route imports the style module of every component it renders, including components with no client code (`manifest()` and `bundles()` add style-only members). Render and server modules stop writing `$$css` in builds. Dev keeps `$$css`, inline `<style>` and the hot `textContent` swap.

## Acceptance

- [ ] A build of the website has no `$$css` in any chunk; each route bundle has its CSS asset, and the layout components land in a shared chunk (add a `manualChunks` rule if Vite does not split them).
- [ ] Byte gate on the real build, the go condition of the spike: two page views in a row (home, then `/docs/components/`, warm cache for shared assets) cost no more gzip bytes than `release/0.9` (spike baseline 189,381 B). If it misses, stop and report; the orchestrator brings it to the maintainer.
- [ ] The two style tests that assert `const $$css` are rewritten; `${}` variables, `targets`, block styles and `<style global>` keep working in dev and build.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck` and the brumate style tests.
