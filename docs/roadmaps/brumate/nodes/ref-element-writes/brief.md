---
id: ref-element-writes
title: A ref in a list whose source reads it settles in a browser render
status: todo
priority: should
type: fix
story:
early: false
outline: true
milestone: 0.8.0
target:
ship: auto
land: auto
from:
size: S
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

# A ref in a list whose source reads it settles in a browser render

## Goal

A row's ref writes `elementAt(...)`, a new `ElementReference` each render, so `Object.is` never matches and the list renders again without end. The resumed page settles. Fix it and remove the `ref-loop` cause from `packages/brumate/test/differential/data.ts`.

## Context

- Item 6 of the client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md). Not probed there. Prove it with the `refLoop` page before changing code.
- Ref slots of resumed pages hold `{scope, anchor}` on purpose (cause `lazy-ref`, accepted).

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
