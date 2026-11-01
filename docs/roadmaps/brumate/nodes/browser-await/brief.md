---
id: browser-await
title: await $memo waits in a component that the browser renders
status: todo
priority: must
type: feature
story: browser-async
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-01
spent:
owns:
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/features.ts
  - packages/brumate/test/resume.test.ts
  - docs/decisions.md
  - website/docs/async-data.md
  - docs/roadmaps/brumate/contracts/client-pending-boundary.md
shared: []
reserves: []
provides: [client-pending-boundary]
depends_on:
  - on: browser-await-spike
    kind: hard
    why: the maintainer chose option 3 and the root boundary at its gate; the prototype patch is the starting point
---

# await $memo waits in a component that the browser renders

## Goal

`const x = await $memo(...)` in the instance script of a component that the browser renders waits for the memo, as on the server. The compiler splits the render at the `await` into a continuation (`$$b.wait(scope, value, rest)`), and the code before it runs once. With no `#loading` above it, the app counts as wrapped in one: a block outside every `#loading` keeps its current content until its waits settle (`hold`), as the server holds the page.

## Decisions (the maintainer, 2026-11-01, at the gate of browser-await-spike)

- Option 3, continuations at `await`.
- The root boundary, not fill in place. A first render with nothing to keep (an `#if` that opens from nothing, a new row, a page only the browser renders) shows nothing until its waits settle, as the server sends nothing.
- Topological starts on both sides (browser-await-blocks and topological-awaits-server).
- No `$result` macro. `wait` reads the slot through one internal three-way read (pending, value, error).

## Context

- Start from `prototype/option3.patch` and the root boundary prototype of the spike, and read its "What the build must fix that the prototype skips": the scope stays out of `rendered` while it waits, the rest writes the settled value into the slot, the awaited memo counts as computed, props set before the wait, a second wait on a newer promise, and throws of the rest go to `fail`.
- Range comments must match `MARKER` in `blocks.ts` (the spike used `<!--l<id>w-->` and `<!--l0b-->`).
- `HAS_ROOT_WAIT` (`__BRUMATE_HAS_ROOT_WAIT__`) turns on `hold` only when a compiled part calls `$$b.wait(`, so todos pays 0 B. Make sure parts from packages (@brumate/ui) set it too.
- `hold` goes at all 15 insert sites (the prototype did 2). Spike estimate: about +365 B gzip with `wait` plus +60 to +100 B for the rest, on a page that uses it.
- Write and freeze `contracts/client-pending-boundary.md`: a boundary counts waits, runs `done` at 0, and keeps the `rendered` and `afterInsert` work of its body. browser-loading-fallback, promise-in-markup and browser-try build on it.
- Update docs/decisions.md:27 and website/docs/async-data.md: `await` now waits in the browser.
- See [browser-await-spike outcome](../browser-await-spike/outcome.md).

## Acceptance

- [ ] One `await $memo` in the instance script of a browser-rendered component waits; the code before it runs once; handlers work after the wait; each memo loads once.
- [ ] Outside every `#loading`, an `#if` branch and a `#for` row that wait keep the current content until they settle; a block that closes or switches back during the wait leaves no markup.
- [ ] `pnpm bench` todos gzip JS before `load`: 0 B change. A page that uses it: the cost is in the outcome.
- [ ] The contract is frozen, and decisions.md and async-data.md are updated.

## Sizing

M: the spike's prototype covers the core; the work is the fixes, the 13 remaining insert sites and the tests.
