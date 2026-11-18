---
id: style-files-links
title: "Pages link component stylesheets in the head"
status: todo
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
spent:
owns: []
shared:
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/html.ts
  - packages/brumate/test/**
reserves: []
provides: []
depends_on:
  - on: style-files-modules
    kind: hard
    why: it reads the CSS assets and the component map that node builds
---

> 2026-11-18: refined from the design in `../style-files-spike/outcome.md` after the maintainer's go on per-bundle CSS with a shared chunk. Read that outcome first; the prototype is the local branch `spike/style-files` (078616fe).

# Pages link component stylesheets in the head

## Goal

`bundleHints` and `ClientBundles.styles` carry each bundle's CSS and a map from component ID to stylesheet URL. The server writes `<link rel="stylesheet">` in the head, in a fixed order, for the components a page renders, instead of `<style>` in the body at the first instance (as Astro and Marko give the server a page-to-stylesheet map).

## Acceptance

- [ ] A built page has no component `<style>` in the body and links its stylesheets in the head in a fixed order; rule order no longer depends on how the user reached the page (test).
- [ ] The byte gate of style-files-modules still holds with the links in place.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck` and the brumate style tests.
