---
id: size-baseline
title: Record the size and speed baseline
status: todo
priority: should
type: chore
outline: false
milestone: smaller-client
target:
from:
size: S
spike: false
verify: pnpm bench
exclusive: [bench]
fulfilled_by: 
gate: false
added: 
owns:
  - docs/performance.md
  - benchmarks/results/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Record the size and speed baseline

## Goal

Run `pnpm bench` on main and record the gzip size of the JS before `load` for todos, the rows scenario and the first click, so each step reports its before and after.

## Context

- The last run is in "A smaller and faster client", from 2026-10-25, before steps 2 and 3 landed.
- Source: [A smaller and faster client](../../../../proposals.md#a-smaller-and-faster-client)

## Acceptance

- [ ] docs/performance.md has the numbers of main, with the commit and the date.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: a run and a record.
