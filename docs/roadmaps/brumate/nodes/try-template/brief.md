---
id: try-template
title: "A #try catches the client errors of a #template inside it"
status: active
priority: must
type: hotfix
outline: false
milestone: 0.4.2
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-02
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/graph.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: try-around-child
    kind: hard
    why: same #try client-catch path in graph.ts and plan.ts (#418)
---

# A #try catches the client errors of a #template inside it

## Goal

A `#template` inside a `#try` sends the client errors of its content (a throwing handler, a rejecting async handler, a throwing effect) to that `#catch`.

## Context

- Found by the try-around-child worker (#418) on 2026-11-02, reported on `main`: a `#template` in a `#try` that holds only a plain button with a throwing handler is not caught. The cause was not found. Confirm it on `main` with a failing test first; if it does not reproduce, close the node with that test as the outcome.
- Read docs/roadmaps/brumate/nodes/try-around-child/outcome.md: the `#try` body scope needed an ID and `tryCatchesClient` needed to see the child. A template may hit the same two gaps.
- Report the todos size of `pnpm bench` (within 0.3 kB).

## Acceptance

- [ ] A test that fails on `main` and passes with the fix, in packages/brumate/test/resume.test.ts.
- [ ] A patch changeset for brumate.

## Sizing

S: one path and one or two tests.
