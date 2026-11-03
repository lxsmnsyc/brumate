---
id: wait-later-memo-update
title: "A write during an await does not update a later awaited memo before its slot holds a value"
status: done
priority: must
type: fix
story: browser-async
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
added: 2026-11-02
spent: 120000
owns: []
shared:
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/client/waits.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: browser-await-blocks
    kind: hard
    why: found in its tests; same wait path
---

# A write during an await does not update a later awaited memo before its slot holds a value

## Goal

In a browser render of a scope with two `await $memo`, a write during the first wait no longer runs the text update of the later awaited memo while that memo's slot is still empty. Today it throws a `TypeError`, reported as `brumate:error`, though the page ends up right.

## Context

- Found by browser-await-blocks on 2026-11-02; on feat/browser-async only (`wait` is not on `main`). It reproduces with the WaitDestr fixture when the prop changes before the first load settles, and predates that node.
- Updates of a slot that a later `wait` has not reached should be skipped, or held for the rest, as the rest's own `setSlots` runs them.
- Follow the client-restructure rule: pending state in scope slots, no new hold-back helpers.

## Acceptance

- [ ] A test that fails on feat/browser-async before the fix: a prop write during the first wait reports no `brumate:error` and the page ends up right.
- [ ] Todos within 0.3 kB.

## Sizing

S: one guard in the update path of a waiting scope and a test.
