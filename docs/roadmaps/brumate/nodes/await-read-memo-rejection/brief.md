---
id: await-read-memo-rejection
title: "A browser render handles the rejection of a memo read only by await"
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

# A browser render handles the rejection of a memo read only by await

## Goal

In a browser render, a memo whose only read is `await memo;` or `$memo(await a)` sends its rejection to the nearest `#catch` or `onError`, with no unhandled rejection.

## Context

- Found by the review of #415 (unread-memo-rejection) on 2026-11-02. It is reported on `main`; confirm it there with a failing test before the fix. If it does not reproduce, close the node with that test as the outcome.
- The browser render turns `await a;` into `a;`. That counts as a read, so #415 does not watch the memo, yet no slot takes the promise either.
- Report the todos size of `pnpm bench` (within 0.3 kB).

## Acceptance

- [ ] A test that fails on `main` and passes with the fix, in packages/brumate/test/resume.test.ts.
- [ ] A patch changeset for brumate.

## Sizing

S: one path and one or two tests.
