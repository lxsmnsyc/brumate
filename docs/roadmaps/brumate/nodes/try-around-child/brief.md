---
id: try-around-child
title: "A #try around only a child component catches its client errors"
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

# A #try around only a child component catches its client errors

## Goal

A `#try` whose body holds only a child component catches the client errors of that child, as it does when the body also holds an element with a handler.

## Context

- Found by the review of #415 (unread-memo-rejection) on 2026-11-02. It is reported on `main`; confirm it there with a failing test before the fix. If it does not reproduce, close the node with that test as the outcome.
- `tryCatchesClient` in packages/brumate/src/graph.ts looks only at the sites of its own component, so the module gets no `t` table entry. The #415 `#catch` fixture keeps a button inside the `#try` to work around it.
- Report the todos size of `pnpm bench` (within 0.3 kB).

## Acceptance

- [ ] A test that fails on `main` and passes with the fix, in packages/brumate/test/resume.test.ts.
- [ ] A patch changeset for brumate.

## Sizing

S: one path and one or two tests.
