---
id: style-files-tests
title: "Build and docs for component stylesheets"
status: done
priority: must
type: chore
story: style-files
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent: 120000
owns: []
shared:
  - packages/brumate/test/**
  - e2e/suites/**
  - website/docs/styles.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: style-files-navigation
    kind: hard
    why: it tests the whole path
  - on: style-files-postcss
    kind: hard
    why: it documents the pipeline
  - on: style-files-inline
    kind: hard
    why: it tests and documents the inline path
---

> 2026-11-18: refined from the design in `../style-files-spike/outcome.md` after the maintainer's go on per-bundle CSS with a shared chunk. Read that outcome first; the prototype is the local branch `spike/style-files` (078616fe).

# Build and docs for component stylesheets

## Goal

A build test (no `$$css` in chunks, no component `<style>`, assets named in the hints), a test of `liveBlocks` variables with linked CSS, the docs of where styles go in a build, and the minor changeset for brumate (rule order and no unstyled frame in the changelog).

## Acceptance

- [ ] The build test and the variables test pass.
- [ ] A minor changeset for brumate.
- [ ] The story acceptance (style-files brief) holds; final byte numbers in the outcome.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck` and the brumate style tests.
