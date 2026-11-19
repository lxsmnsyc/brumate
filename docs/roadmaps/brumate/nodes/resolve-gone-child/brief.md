---
id: resolve-gone-child
title: A browser render of ResolveGoneChild leaves a promise in a slot
status: todo
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.8.1
target: main
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
added: 2026-11-19
spent:
owns: []
shared:
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: pending-read
    kind: hard
    why: the same family (a pending value read during a browser render); fix after pending-read lands so the cause is clear
---

> 2026-11-19: found by the pending-read worker and confirmed by its fresh review. It fails on main, deterministically (4 of 4 runs), not only under load.

# A browser render of ResolveGoneChild leaves a promise in a slot

## Goal

The differential test page `ResolveGoneChild` (packages/brumate/test/render) renders different slots in the browser than on the server: server `["Ada","Ada"]`, browser `["Ada","[promise]"]` in `ResolveGoneChild_rr0pa3`. Its 400 ms server function settles, but the browser leaves the promise in the second slot. Find why and fix it so the page renders the same on both paths.

## Acceptance

- [ ] Prove it on `batch/brumate-main` (with pending-read landed): `npx vitest run test/differential-*.test.ts -t ResolveGoneChild` fails with the slot diff.
- [ ] Fix the cause; the page passes as a same page, and the differential suite stays green.
- [ ] A patch changeset.
- [ ] Fast check passes; `pnpm test` in packages/brumate passes.
