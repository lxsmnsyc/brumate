---
id: state-printed-html
title: The state leaves out raw HTML the markup printed
status: done
priority: should
type: feature
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: L
risk: high
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/state-dedupe.test.ts
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-26
spent: 620971
owns:
  - packages/brumate/test/state-dedupe.test.ts
  - docs/roadmaps/brumate/nodes/state-printed-html/**
shared:
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/serial.ts
  - packages/brumate/src/shared.ts
  - packages/brumate/src/html.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/features.ts
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: state-dedupe-spike
    kind: hard
    why: builds what the spike proved, with its review's fixes
---

# The state leaves out raw HTML the markup printed

## Goal

The maintainer chose go on 2026-11-26 after state-dedupe-spike: the server leaves long raw HTML out of the state record, and the browser reads it back from the markup it printed. Navigation responses on the website get 17 to 21% smaller gzipped. Build it safely: the spike's prototype throws on cases the base handles.

## Context

- Read `nodes/state-dedupe-spike/outcome.md` and `review.md`. The prototype is on the local branch `experiment/state-dedupe-spike` (ff2e8618, e01a1fc0, d76ef9ef): start from it, not from scratch.
- The review's fixes are part of this node (each with a test):
  1. `printable()` treats an unknown parent as safe. Pass a "printable here" bit at the call site for component roots and children bodies, or don't mark inserts whose parent is unknown. Never mark in `#head`. Tests: `<Link>{page.body}</Link>` inside a `#key` (Link renders `<a>{children}</a>`), and `<template><Wrap doc=page.body/></template>`.
  2. A navigation that keeps a layout must not throw. Read the ranges from the fetched document before `replaceRoutes` drops it, or decode `$b.d` lazily. Test it through the real `replaceRoutes`, with a layout that prints raw HTML in its state.
  3. `balanced()` refuses `<pre>`, `<textarea>` and `<listing>` text that starts with a newline, and `shadowrootmode` templates.
  4. No markers left in the DOM when a record has no `$b.d` (12 on `/` in the prototype).
  5. Prune the reader and the markers by use: a page or app with no marked insert pays 0 B (todos was +256 B in the prototype). The fallback walk goes.
  6. Deterministic marker tokens, so static builds are reproducible, and a dev error for a range with no end.
- partial-route-responses stays parked (the maintainer, 2026-11-26): the slow navigations are static pages, which it can't reach.

## Acceptance

- [ ] Every case of the review is a test and passes; resume, render and differential tests pass; `run.mjs --check` passes in Chrome.
- [ ] Navigation gzip on `/docs/context` and `/ui/dialog` at least 15% smaller than base (`bytes.mjs` from the spike).
- [ ] Todos gzip JS before `load` unchanged (`pnpm bench --only brumate --scenario todos`).
- [ ] A minor changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

L: the prototype plus six fixes across codegen, the server state, the client reader and navigation.
