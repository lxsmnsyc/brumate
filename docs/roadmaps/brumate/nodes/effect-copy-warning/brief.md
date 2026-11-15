---
id: effect-copy-warning
title: A warning for an effect that only copies signals
status: todo
priority: must
type: feature
story:
early: false
outline: true
milestone: 0.9.0
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
depends_on: []
---

# A warning for an effect that only copies signals

## Goal

The analyzer warns when an effect only assigns signals that nothing else writes, and names the `$memo` that replaces it. `brumate check`, the editor and the dev server show it.

## Context

- Source: [Effects that only copy signals](../../../../proposals.md#effects-that-only-copy-signals), with both rules and the cases that stay quiet.
- One check in `analyze.ts`, a catalog entry (the next free BRM code) and tests.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
