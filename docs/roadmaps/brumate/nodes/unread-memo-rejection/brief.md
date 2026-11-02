---
id: unread-memo-rejection
title: A browser render handles the rejection of an async memo that nothing reads
status: active
priority: must
type: hotfix
outline: false
milestone: 0.4.2
target: main
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "unread async memo"
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-02
spent: 198000
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on: []
---

# A browser render handles the rejection of an async memo that nothing reads

## Goal

A component that the browser renders, with an async memo that no update reads, routes the memo's rejection to the nearest `#catch` or `onError`, as a server render does. No unhandled rejection reaches the page.

## Context

- Found during browser-await (#413) on 2026-11-01. It exists on `main` (57856a1b), so the fix branches from `main` and ships in 0.4.2.
- The memo gets no slot, so the compiled render is `const side = (fail());` with no `setSlots`, and nothing attaches a handler.
- Repro: /private/tmp/claude-501/-Users-alexis-Documents-GitHub-brumate/c45168df-c5c5-4277-9330-4639c7ee2942/scratchpad/unread-memo-repro/ (README.txt has the steps). A child under `#if` with `const side = $memo(fail());`, where `fail` rejects after 10 ms. Result on `main`: `expected [ 'Error: side failed' ] to deeply equal []`.
- #413 on `feat/browser-async` has the same gap for an async memo before an `await`. When `next` syncs with `main`, check that the fix holds there.
- Report the todos size of `pnpm bench` (within 0.3 kB).

## Acceptance

- [ ] The repro test passes, named "unread async memo", in packages/brumate/test/resume.test.ts.
- [ ] The rejection reaches the nearest `#catch` in a browser render, with a test.
- [ ] A patch changeset for brumate.
- [ ] Todos gzip JS before `load` stays within 0.3 kB of 14.5 kB.

## Sizing

S: one codegen or runtime path and two tests.
