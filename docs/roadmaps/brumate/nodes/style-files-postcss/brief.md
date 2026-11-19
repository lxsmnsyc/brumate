---
id: style-files-postcss
title: "The project's CSS pipeline runs on component styles in builds"
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
  - packages/brumate/src/css.ts
  - website/docs/styles.md
  - packages/brumate/test/**
reserves: []
provides: []
depends_on:
  - on: style-files-modules
    kind: hard
    why: the pipeline runs on the style modules that node adds
  - on: style-files-inline
    kind: hard
    why: the inline copy must take the same transforms as the sheet
---

> 2026-11-18: refined from the design in `../style-files-spike/outcome.md` after the maintainer's go on per-bundle CSS with a shared chunk. Read that outcome first; the prototype is the local branch `spike/style-files` (078616fe).

# The project's CSS pipeline runs on component styles in builds

## Goal

With real CSS modules, the project's PostCSS config, Lightning CSS `targets` and the minifier run on scoped CSS in a build. The spike saw PostCSS plugins not run under `css.transformer: 'lightningcss'`; check the order on a real build and document what runs.

## Acceptance

- [ ] Since style-files-inline, each component's CSS ships twice: inline in the server render and in the bundle sheet. Both copies take the same transforms (PostCSS, Lightning CSS targets, `url()` rewriting); a build test compares them for a component that uses a transform.

- [ ] A build test with a PostCSS plugin and a `targets` value shows both applied to component CSS.
- [ ] `website/docs/styles.md` names what runs in dev and in a build, including the Lightning CSS case.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck` and the brumate style tests.
