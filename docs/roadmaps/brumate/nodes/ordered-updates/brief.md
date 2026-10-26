---
id: ordered-updates
title: Ordered updates
status: todo
priority: must
type: feature
outline: false
milestone: core-correct
target:
from:
size: L
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "updates of a signal and a memo of it"
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/brumate/src/plan.ts
  - packages/brumate/src/codegen/client.ts
  - packages/brumate/src/runtime/client/updates.ts
shared:
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: split-client-runtime
    kind: hard
    why: it rewrites run, memo and writeSlot, which the split moves
---

# Ordered updates

## Goal

Run the memos of a write in topological order, each once, and queue the bindings so each runs once when the outermost update ends. A child gets every new prop before it computes. The `it.fails` tests of "updates of a signal and a memo of it" become `it`.

## Context

- The compiler knows the graph. `g` lists the updates of a slot in declaration order today (client.ts).
- Proposal #152, tests #155.
- Source: [Ordered updates](../../../../proposals.md#ordered-updates)

## Acceptance

- [ ] The 5 `it.fails` tests under "updates of a signal and a memo of it" in packages/brumate/test/resume.test.ts pass as `it`.
- [ ] The size of the core and of the `g` tables is measured before and after.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

L: uncertainty medium (async memos and `$bind` writes start passes of their own), blast radius high (core update code).

## Notes for the worker

- Memos stay eager, so a handler that writes and then reads a memo reads the new value.
