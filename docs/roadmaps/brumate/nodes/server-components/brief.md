---
id: server-components
title: "Server components and #server"
status: todo
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
  - on: server-components-spike
    kind: hard
    why: the design comes from the spike
---

> 2026-11-19: parked. server-components-spike was a no-go (gates 2 and 3 failed: 36 lines against 34 for a `$memo` of a server function returning `raw()` HTML, and +316 to +1,120 B gzip JS before `load`), confirmed by a fresh review and accepted by the maintainer. A restart should start from its finding that `render(Root, props, { base })` is the right base, not `#defer`, and should gate on round trips and bytes rather than line counts. See `../server-components-spike/outcome.md`.

# Server components and #server

## Goal

A component that renders on the server again when its inputs change, with children that keep their state.

## Context

- Source: [Server components and #server](../../../../proposals.md#server-components)

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
