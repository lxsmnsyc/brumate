---
id: fixed-walks
title: Fixed walks
status: todo
priority: later
type: feature
outline: true
milestone: backlog
target:
from:
size: M
spike: false
verify: 
exclusive: []
fulfilled_by: 
gate: false
added: 
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: clone-remaining-bodies
    kind: hard
    why: it needs every body to be a cloned template (re-pointed from drop-marker-index, dropped 2026-11-12)
---

# Fixed walks

## Goal

Emit the walk of a cloned template as code, as Solid and Svelte do. About 2 to 3% of a click. Branch exp/fixed-walk.

## Context

- 2026-11-12: the encoded walk (#164) took most of this gain since the measurement of 2026-10-25: allocations for 1,000 rows went from 1200 kB to 807 kB, against 769 kB for the fixed walk. Measure again before it starts.
- Source: [Fixed walks](../../../../proposals.md#later-fixed-walks)

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
