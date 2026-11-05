---
id: render-memos
title: The browser render runs each memo once, with no refresh after the render
status: todo
priority: must
type: refactor
outline: false
milestone: 0.6.1
target: main
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent:
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: client-audit
    kind: hard
    why: ranked first in its removals
---

# The browser render runs each memo once, with no refresh after the render

## Goal

Item 1 of the client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md): the render module runs `$memo` through a helper that catches a throw and starts the load, so the second memo run after every browser render (`refresh(live, true)`) can go. Fixes the causes memo-throw, debounce-start and function-prop-reads of the differential test (7 pages).

## Context

- A scratch edit in the audit showed that deleting the refresh alone fixes 2 causes but breaks 6 async-memo tests; the helper must start those loads.
- Remove each fixed cause from the differential test's list.

## Acceptance

- [ ] The three causes leave the differential test's list, and the async-memo tests pass.
- [ ] Todos within 0.3 kB; record the figure.
- [ ] A patch changeset if users can see a change.

## Sizing

M.
