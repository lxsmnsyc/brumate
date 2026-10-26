---
id: scope-id-table
title: One table of the fields with scope IDs
status: active
priority: must
type: refactor
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/scope-ids.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - packages/brumate/src/runtime/shared.ts
  - packages/brumate/src/runtime/client-routes.ts
  - packages/brumate/test/scope-ids.test.ts
shared:
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/serial.ts
  - packages/brumate/src/runtime/devtools.ts
reserves: []
provides: []
depends_on: []
---

# One table of the fields with scope IDs

## Goal

Put the record fields and reference classes that hold a scope ID in one table in shared.ts, with how to read and write each ID. `shiftState` and the other places that walk them read the table.

## Context

- Three bugs in a week came from a place that missed a field (#168, #203, #212). `shiftState` in client-routes.ts is a hand-written chain of `instanceof`.
- client-routes.ts imports no code of its own, so it stays small and loads lazily (its comment at line 28). Keep that: client.ts passes the table to `shiftState` as an argument.
- Other walkers: `parseId` in client.ts, the plugins of serial.ts, and devtools.ts. Each reads the table, or the outcome says why not.
- Source: [One table of the fields with scope IDs](../../../../proposals.md#one-table-of-the-fields-with-scope-ids)

## Acceptance

- [ ] A test builds a record with every field and reference, moves it, and fails when one keeps its old ID, or when a new field with an ID is not in the table.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one table and its readers. The Order of the proposals puts it first.
