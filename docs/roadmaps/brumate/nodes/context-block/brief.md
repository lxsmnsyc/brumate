---
id: context-block
title: Weigh a `#context (key, value)` block in place of $setContext
status: todo
priority: later
type: spike
outline: true
milestone: backlog
target:
from:
size: M
spike: true
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: context-writer-loop
    kind: hard
    why: its fix shows whether the hidden-write problem needs a syntax change at all
---

# Weigh a `#context (key, value)` block in place of $setContext

## Goal

Decide whether a markup block `#context (key, value) { ... }` should replace `$setContext`, as a way to stop writes through context functions that the compiler cannot see (debate function-prop-derivations, J8, P9, O7).

## Context

- The maintainer asked on 2026-10-31. A `#context` block was skipped on 2026-10-26, because a `#` block is only for markup and `$setContext` works in `.brm.ts` module functions, which a block cannot.
- The orchestrator's first view: a block changes where a context is provided, not what it holds. A writer function in the value stays hidden from a reader in another file either way. What hides a write is that the reader compiles without the provider's code. Two directions to compare against a block:
  - a context key declared once in a module with its type, so the project analysis can give readers which members write (as it gives parents the live props of children);
  - per-member updates: re-send a context member only when that member's reads change, which is the root of context-writer-loop.
- Weigh it with a goal debate before any build.

## Acceptance

- [ ] A debate or spike outcome that says block, module-declared key, per-member updates, or none, with evidence from context-writer-loop's fix.

## Sizing

M: a debate and a small probe.
