---
id: style-files-navigation
title: "Client navigation loads the next page's stylesheets before the swap"
status: done
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
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent: 327000
owns: []
shared:
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/runtime/client/page.ts
  - packages/brumate/src/runtime/bundles.ts
  - packages/brumate/src/runtime/loader.ts
  - packages/brumate/test/**
  - e2e/suites/**
reserves: []
provides: []
depends_on:
  - on: style-files-links
    kind: hard
    why: it reads the `<link>` markup that node writes
---

> 2026-11-18: refined from the design in `../style-files-spike/outcome.md` after the maintainer's go on per-bundle CSS with a shared chunk. Read that outcome first; the prototype is the local branch `spike/style-files` (078616fe).

# Client navigation loads the next page's stylesheets before the swap

## Goal

`navigate.ts` preloads and awaits the new page's stylesheets before the swap; `keepStyles` and `replaceRoutes` handle `<link b-style>`; the loader loads a bundle's CSS with its chunk, and `addStyle` takes a URL. The prototype (`078616fe`) has a working start.

## Acceptance

- [ ] An e2e test navigates with the stylesheet delayed 400 ms and sees no unstyled frame (the spike saw 0 of 92 frames pending).
- [ ] A component rendered by the browser after load gets its stylesheet before it shows.
- [ ] Todos JS gzip before `load` from `pnpm bench --only brumate --scenario todos` is recorded (13.8 kB on `release/0.9`).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck` and the brumate style tests.
