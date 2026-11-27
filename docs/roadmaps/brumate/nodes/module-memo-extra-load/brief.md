---
id: module-memo-extra-load
title: "Diagnose: an extra load of a module async memo, once on Node 24 CI"
status: todo
priority: should
type: diagnose
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: S
risk: low
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent:
owns:
  - docs/roadmaps/brumate/nodes/module-memo-extra-load/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Diagnose: an extra load of a module async memo, once on Node 24 CI

## Goal

CI run 45720810883 of PR #535 failed once on Node 24: `packages/brumate/test/module-signals.test.ts` > "loads again when a source changes in another component, and writes only the latest run" saw `browser.calls.user` 3 instead of 2 (line 653), 291 ms after the file started, about 1 s into the suite. Node 22 passed it, and the rerun passed on both. Find whether it is a real race or a test timing assumption, with the root-cause skill.

## Context

- A first pass (2026-11-26) could not reproduce it locally in about 30 runs: alone, with 12 CPU burners, with event-loop stalls, code loaded late, and 7 full-suite runs. The logged extra-load paths in `runtime/store.ts` (`follow()`'s `seen && changed(true)`, `ensure()`'s `count === 0 && changed()`) never ran in this test. Its scripts and logs were in the session scratchpad and are gone.
- Leads: a load of 1 in the browser at resume when the page state arrives after the module starts (the failing test clicks with no wait, while the first test waits 40 ms); a reader's subscriptions dropping to 0 and back after a write; Node 24 timer or microtask order.
- Next step: a temporary debug commit on a branch that logs each `fetchUser` call with its module instance and stack, run on CI with Node 24 (the repo is public, so CI is not billed) until it fails.

## Acceptance

- [ ] The outcome has a diagnosis: the cause at file and line and where the fix goes, or, after a set number of CI runs with no failure, the runs and the decision to close.

## Sizing

S: a diagnose node.
