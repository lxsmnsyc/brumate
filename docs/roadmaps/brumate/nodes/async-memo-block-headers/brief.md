---
id: async-memo-block-headers
title: "Block headers, props and #for lists wait for a constant async memo in a browser render"
status: todo
priority: must
type: hotfix
outline: false
milestone: 0.4.2
target: main
from:
size: M
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
  - on: markup-read-async-memo
    kind: hard
    why: extends the fillSettled path of #419 from text and attributes to headers, props and lists
---

# Block headers, props and #for lists wait for a constant async memo in a browser render

## Goal

In a browser render, an async `$memo` whose input never changes, read by an `#if`, `#switch` or `#for` header, a component prop, or inside a function in markup, gives the same result as a server render: the settled value, not the promise.

## Context

- #419 (markup-read-async-memo) fixed text and attributes and listed these reads as limits. On 2026-11-02 the compiled update part for `const user = $memo(loadUser()); #if (user.admin) {...}` in a browser-rendered block is `$$b.branchNodes(..., (user.admin) ? 0 : 1, ...)`: `user` is the promise, `user.admin` is `undefined`, the `#else` branch is chosen once and never again. The server render awaits the memo first (`$$b.ready`), so it picks the right branch. `#if (user)` picks the first branch even when the promise later resolves to `null`.
- The same holds for a prop (`<Card user={user} />` passes the promise), a `#for` list (iterates the promise), and `{list.map(() => user)}`.
- Confirm each case on `main` with a failing test first.
- Decide in the node: hold the block's choice until its memos settle (as `fillSettled` does for text), or treat the memo as live in the browser only. Keep server output unchanged.
- Report the todos size of `pnpm bench --only brumate --scenario todos` (within 0.3 kB).

## Acceptance

- [ ] Tests that fail on `main` and pass with the fix, for `#if`, `#for`, a prop and a read inside a function, in packages/brumate/test/resume.test.ts.
- [ ] A rejection in any of these reaches the nearest `#catch`, reported once.
- [ ] A patch changeset for brumate.

## Sizing

M: the block, prop and list paths of the client codegen.
