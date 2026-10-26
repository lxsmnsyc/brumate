---
id: scope-id-table
title: One table of the fields with scope IDs
status: todo
priority: must
type: refactor
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
reserves: []
provides: []
depends_on: []
---

# One table of the fields with scope IDs

## Goal

Put the record fields and reference classes that hold a scope ID in one table in shared.ts, with how to read and write each ID. `shiftState` and the other places that walk them read the table.

## Context

- Three bugs in a week came from a place that missed a field (#168, #203, #212). `shiftState` in client-routes.ts is a hand-written chain of `instanceof`.
- Source: [One table of the fields with scope IDs](../../../../proposals.md#one-table-of-the-fields-with-scope-ids)

## Acceptance

- [ ] A test builds a record with every field and reference, moves it, and fails when one keeps its old ID, or when a new field with an ID is not in the table.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one table and its readers. The Order of the proposals puts it first.
