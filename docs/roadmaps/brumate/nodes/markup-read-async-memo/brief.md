---
id: markup-read-async-memo
title: "An async memo whose input never changes fills in a browser render"
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
spent: 266000
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

# An async memo whose input never changes fills in a browser render

## Goal

In a browser render, an async `$memo` whose input never changes shows its value in markup when it settles, and its rejection reaches the nearest `#catch`.

## Context

- Proved on `main` (56e665d5) on 2026-11-02 with /private/tmp/claude-501/-Users-alexis-Documents-GitHub-brumate/c45168df-c5c5-4277-9330-4639c7ee2942/scratchpad/gap-proofs/proofs.patch. The cause is wider than "read only by markup": an async `$memo` with no input that changes (no signal, or a signal nothing writes) never fills its text in a browser render, also when a handler reads it and also in a block script of the same component. The compiled render calls `$$b.setContent(el, value)` with no scope and no `$$b.keep`, so nothing writes the settled value. boom.brm (`$memo(load(step))` with `step++` in a handler) gets `keep` and the scope, and fills. All five "markup" tests in the patch time out with `<p class="value"></p>`.
- Not promise-in-markup: that node renders raw promises in markup for 0.5.0. This is `$memo` of a promise, which already works on `main` when its input changes. Check whether its rejection reaches `#catch` too; it has a slot, so #415 does not watch it.
- Apply the patch on a branch from `main`, keep the tests of this node (rename the describe), drop the rest.
- Report the todos size of `pnpm bench` (within 0.3 kB).

## Acceptance

- [ ] A test that fails on `main` and passes with the fix, in packages/brumate/test/resume.test.ts.
- [ ] A patch changeset for brumate.

## Sizing

S: one path and one or two tests.
