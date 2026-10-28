---
id: bind-read-your-writes
title: A bound prop reads its new value right after its setter runs
status: todo
priority: should
type: fix
outline: false
milestone: core-correct
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/**
  - packages/brumate/test/**
  - packages/ui/src/fields.ts
  - packages/ui/src/**
  - website/ui/state.md
  - docs/decisions.md
reserves: []
provides: []
depends_on:
  - on: ui-refused-write-sync
    kind: hard
    why: it found the gap and sets the onChange rule this node completes
---

# A bound prop reads its new value right after its setter runs

## Goal

After a component writes a prop bound with `$bind(signal, fn)`, a read of that prop in the same turn returns what the caller's signal holds now (read-your-writes), not the value from before the write. Then @brumate/ui calls `onChange` with the kept value, synchronously, only when it changed.

## Context

- Found in the review of ui-refused-write-sync (#332): a child reads the old value until the caller draws. A per-part `setTimeout` worked around it and was dropped, because it reordered handlers (Menu, Tabs), lost `window.event`, mixed values on fast typing and never fired for a setter that accepts later. The maintainer chose this runtime fix (option C) on 2026-10-28; not in the 0.4.0 cut.
- With it, `afterWrite` in packages/ui/src/fields.ts keeps only its synchronous branch. State in website/ui/state.md that a setter that accepts later reports through the signal, not `onChange`.
- Size first: report the todos size; within 0.3 kB.

## Acceptance

- [ ] A runtime test: write a bound prop with a setter that rounds; the next read returns the rounded value in the same turn.
- [ ] @brumate/ui `onChange` gets the kept value synchronously for refusing, rounding and accepting setters; handler order and `window.event` match the own-state case.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one runtime read path and the ui follow-up.
