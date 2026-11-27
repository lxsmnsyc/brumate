---
id: stop-ends-loads
title: A stopped page ends the code loads still in flight
status: active
priority: should
type: hotfix
story:
early: false
outline: false
milestone: 0.9.1
target: main
ship: auto
land: auto
from:
size: S
risk: medium
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/module-signals.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-27
spent:
owns:
  - docs/roadmaps/brumate/nodes/stop-ends-loads/**
shared:
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/module-signals.test.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: module-memo-extra-load
    kind: hard
    why: builds the fix its diagnosis chose
---

# A stopped page ends the code loads still in flight

## Goal

module-memo-extra-load (2026-11-27) found the cause of the extra module memo load on CI: `stop()` calls `dispose()` (`client/boot.ts`, `client/resume.ts`), which ends neither the code loads in flight nor their store links. Code that finishes loading after `stop()` still subscribes the old scopes to module stores and seeds them through `i.s()` (`client/context.ts`, the `.then` of `resumeStoreReads`). After `vi.resetModules()` those scopes link to the next test's module instance, which then has readers and loads in the browser. Load decides it (CI: 15 of 300 runs red with CPU burners, 0 of 300 without). The same code is on main, so it is a 0.9.1 hotfix.

## Context

- Read `nodes/module-memo-extra-load/outcome.md` on the batch branch `batch/brumate-release-0.10` (`git show batch/brumate-release-0.10:docs/roadmaps/brumate/nodes/module-memo-extra-load/outcome.md`), and its `repro/` patches: `cross-test-repro.patch` (red every time), `fix-probe.patch`, `regression-test.patch` (fails on base with `expected 1 to be +0`).
- Fix: a stop of the loader ends in-flight links (a counter bumped on stop, checked where the loaded code links). Keep `leaveRoutes()` (partial navigation) out of it, so a kept layout still loading its code keeps its `$store` links. Check the other `loadModule` continuations (`client/branches.ts`, `client/errors.ts`, `client/insert.ts`) for the same flaw and fix them the same way.
- The regression test goes into `test/module-signals.test.ts`. The diagnosis saw one more red test of the same kind ("a date that changed on the server loads once in the browser", a late `StampView` load); check it passes in the repro loop with the fix.

## Acceptance

- [ ] The regression test fails on main and passes on the branch; the cross-test repro loop is green 5 of 5.
- [ ] Resume, differential and module-signals tests pass; `node e2e/run.mjs` passes.
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

S: one guard in the loader's continuations and a regression test.
