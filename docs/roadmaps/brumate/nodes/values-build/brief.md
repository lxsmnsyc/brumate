---
id: values-build
title: Functions for values
status: dropped
priority: later
type: story
outline: true
milestone: backlog
target:
from:
size: XL
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
  - on: values-spike
    kind: hard
    why: the design and the go come from the spike
  - on: ordered-updates
    kind: hard
    why: it replaces how the update tables run
---

> Dropped on 2026-11-03: values-spike missed its gates (#451, nodes/values-spike/outcome.md) and the maintainer took the no-go. Both render paths stay; the client is simplified one special case at a time, from the client-audit node.

# Functions for values

## Goal

On a go of values-spike (docs/debates/client-restructure/debate.md, step 5): the two-mode value functions replace `g`, `pass`/`queueWrite`/`drain` and the settled-memo mechanism. settled-memo-merge (2026-11-02) left two ways of waiting on one boundary in waits.ts: `wait` (the rest of the instance script) and `fillSettled` (single held writes); values-build removes the second. Acceptance includes the full ordered-updates set (107 cases, O9). Absorbs direct-update-calls (P7). About 1.5-2M tokens.

Step 4 of the smaller client, if values-spike says go.

## Context

- Source: [Functions for values](../../../../proposals.md#steps)

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
