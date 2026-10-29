---
id: realtime
title: Two-way realtime
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
depends_on: []
---

# Two-way realtime

## Goal

Socket functions that return a channel, `createChannel` on both sides, closing from either end, reconnection, and a WebSocket transport with a fallback.

## Context

- Source: [Two-way realtime](../../../../proposals.md#two-way-realtime)
- The channel core stays transport-agnostic, with no brumate imports. Extraction target after sockets and workers both use it: a `seroval-rpc` package. See [Where the channel core lives](../../../../proposals.md#where-the-channel-core-lives).

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
