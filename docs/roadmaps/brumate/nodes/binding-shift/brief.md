---
id: binding-shift
title: Navigation moves the scope IDs of bindings
status: done
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/scope-ids.test.ts
exclusive: []
fulfilled_by: "#261"
gate: false
added: 2026-10-26
owns:
  - packages/brumate/src/runtime/shared.ts
  - packages/brumate/src/runtime/client-routes.ts
  - packages/brumate/test/scope-ids.test.ts
  - packages/brumate/test/render/BindLate.brm
  - packages/brumate/test/render/bindLateParent.brm
  - packages/brumate/test/render/bindLateSetter.brm
shared:
  - packages/brumate/test/resume.test.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: scope-id-table
    kind: hard
    why: the fix is a row of the table that scope-id-table adds
---

# Navigation moves the scope IDs of bindings

## Goal

A `Binding` in the page state, such as a bound prop that a `...rest` passes on, holds scope IDs in its `ref` (a SlotReference) and its `set` (often a FunctionReference). Client navigation with `b-offset` does not move them, so after navigation the binding writes to a slot of the old ID: a scope that is gone, or a live scope of another page. Add Binding to the table of scope-ID fields, so `shiftState` moves both.

## Context

- Found in the review of #249. On main, `shiftValue` in client-routes.ts has cases for only the Element, Function, Children and Slot references, and the generic walk skips class instances, so `Binding` falls through.
- Bindings reach the page state through `stateValues.b` and the BindingPlugin of serial.ts (a binding that a rest prop holds).
- Repro: `shiftState(SCOPE_IDS, { 1: { s: [new Binding(1, new SlotReference(2, 3), new FunctionReference('X#h', 2))] } }, 100)` leaves `ref.scope` and `set.scope` at 2.
- Source: the review of #249, 2026-10-26.

## Acceptance

- [x] The repro is a test in scope-ids.test.ts, and it fails before the fix.
- [x] The class scan of the test covers classes that hold a reference with an ID, not only a `scope` field, so Binding cannot be missed again.
- [x] The size of the eager core does not grow by more than 0.1 kB gzip.
- [x] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one row of the table and its test.

## Log

- 2026-10-27: the review of #261 asked for an end-to-end test of a binding after navigation, so its fixtures and resume.test.ts are part of the node.
