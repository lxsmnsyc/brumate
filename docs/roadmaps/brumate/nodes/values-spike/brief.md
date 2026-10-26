---
id: values-spike
title: Spike: functions for values
status: todo
priority: could
type: spike
outline: false
milestone: smaller-client
target:
from:
size: M
spike: true
verify: 
exclusive: [bench]
fulfilled_by: 
gate: false
added:
owns:
  - docs/roadmaps/brumate/nodes/values-spike/**
shared: []
reserves: []
provides: []
depends_on:
  - on: size-baseline
    kind: hard
    why: it measures against the baseline
---

# Spike: functions for values

## Goal

Find out what step 4 saves: the compiler emits a function for each value that changes, which writes its nodes and calls the readers, and the update tables go. Try it on the rows benchmark and todos, and write the numbers and a design in the outcome.

## Context

- Ordered updates change how `g` is read. The design must say how the two fit, or whether step 4 replaces the queue.
- Source: [A smaller and faster client, step 4](../../../../proposals.md#steps)

## Acceptance

- [ ] outcome.md has the size and speed against the baseline, a design, and a go or no-go.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: time-boxed to three days.
