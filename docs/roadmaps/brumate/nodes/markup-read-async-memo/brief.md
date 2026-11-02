---
id: markup-read-async-memo
title: "An async memo read only by markup fills in a browser render"
status: todo
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
  - on: unread-memo-rejection
    kind: hard
    why: same codegen and runtime path; builds on its unreadMemo watch (#415)
---

# An async memo read only by markup fills in a browser render

## Goal

In a browser render, an async memo that only markup reads shows its value when it settles, and its rejection reaches the nearest `#catch`.

## Context

- Found by the review of #415 (unread-memo-rejection) on 2026-11-02. It is reported on `main`; confirm it there with a failing test before the fix. If it does not reproduce, close the node with that test as the outcome.
- The memo gets no slot, so the markup stays empty and the rejection is not handled. Check how far this overlaps promise-in-markup (browser-async, 0.5.0); this node fixes the 0.4.x behavior on `main` only.
- Report the todos size of `pnpm bench` (within 0.3 kB).

## Acceptance

- [ ] A test that fails on `main` and passes with the fix, in packages/brumate/test/resume.test.ts.
- [ ] A patch changeset for brumate.

## Sizing

S: one path and one or two tests.
