---
id: await-read-memo-rejection
title: "A browser render handles the rejection of a memo read only by await"
status: done
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
spent: 88000
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

- Proved on `main` (56e665d5) on 2026-11-02: test "await-read-memo-rejection" in the describe "PROVE 0.4.2 gaps" of /private/tmp/claude-501/-Users-alexis-Documents-GitHub-brumate/c45168df-c5c5-4277-9330-4639c7ee2942/scratchpad/gap-proofs/proofs.patch fails 3 of 3 runs with `expected [ 'Error: gap failed' ] to deeply equal []`. Fixtures: GapAwaitKid.brm (`const side = $memo(gapFail()); await side;`), gapAwaitHost.brm, gapData.ts.
- Apply the patch on a branch from `main`, keep the tests of this node (rename the describe), drop the rest.
- The browser render turns `await a;` into `a;`. That counts as a read, so #415 does not watch the memo, yet no slot takes the promise either.
- Report the todos size of `pnpm bench` (within 0.3 kB).

## Acceptance

- [ ] A test that fails on `main` and passes with the fix, in packages/brumate/test/resume.test.ts.
- [ ] A patch changeset for brumate.

## Sizing

S: one path and one or two tests.
