---
id: pending-read
title: A browser render holds at a read of a property of a pending memo
status: todo
priority: must
type: fix
story:
early: false
outline: true
milestone: 0.8.1
target: main
ship: auto
land: auto
from: 
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

# A browser render holds at a read of a property of a pending memo

## Goal

A memo or a function prop that reads a property of a memo that is still pending (`user.name`) throws in the first browser render. The server holds the markup. Add the hold at that read, and remove the `pending-read` cause from `packages/brumate/test/differential/data.ts` (`fnReadAsync`, `loadingChain`, `loadingOnChain`).

## Context

- Item 8 of the client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md). It waited for browser-async, which shipped in 0.5.0.
- Keep pending state in scope slots, not new hold-back helpers (docs/decisions.md, the client restructure entry).

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
