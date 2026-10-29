---
id: late-state-record
title: A late state record does not overwrite a memo that loaded again
status: todo
priority: should
type: fix
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-29
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/resume.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/test/**
reserves: []
provides: []
depends_on: []
---

# A late state record does not overwrite a memo that loaded again

## Goal

When a state record settles a streamed slot, resume.ts:229-233 writes the result if the slot still holds the same promise. A memo that loads again in the browser keeps its slot as is until the new load settles (asyncMemo, updates.ts:270-285), so the slot still holds the server's promise. If the source changed before the record arrived, the server's old value lands after the change and readers see it as current; if the new load settled first, a later record would also be dropped or win by timing alone. The record must write only when no newer load of that memo has started (`loads` in updates.ts).

## Context

- Found on main on 2026-10-29 with the same example as [streamed-memo-reads](../streamed-memo-reads/brief.md): `id` changes at idle before the record of `fetchData(undefined)` arrives, and the effect logs the old result after `id` changed.
- Any reader sees it, not only effects: markup inside a `#loading` body that the browser updates, other memos.
- A main bug: branch from main, its own PR. Start with an `it.fails` test.

## Acceptance

- [ ] A test: the source of a streamed memo changes before its record arrives; the record does not replace the value of the newer load, in both settle orders.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one guard and a test.
