---
id: primitive-await-memo
title: "An async memo the compiler takes for a primitive, with await inside, fills in a browser render"
status: done
priority: must
type: hotfix
outline: false
milestone: 0.4.3
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-02
spent: 89000
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

# An async memo the compiler takes for a primitive, with await inside, fills in a browser render

## Goal

In a browser render, `$memo(`Hi ${(await load()).name}`)`, or any async memo whose expression the compiler takes for a primitive, shows its value once it settles, and a rejection reaches the nearest `#catch`.

## Context

- Found by browser-loading-fallback on 2026-11-02. Its probe on feat/browser-async showed `""` after the load settled. The cause is the `isPrimitive` check in `settledMemos` in packages/brumate/src/codegen/markup.ts (origin/main markup.ts:566): a template literal counts as primitive, so the write is not held for the memo, though `await` inside makes it a promise.
- Confirm it on `main` with a failing test first; if it does not reproduce, close the node with that test.
- The same `isPrimitive` skip is in `watchUnreadMemos` (#415); check whether an unread memo of that shape rejects unhandled too.
- Report the todos size of `pnpm bench --only brumate --scenario todos` (within 0.3 kB).

## Acceptance

- [ ] A test that fails on `main` and passes with the fix, in packages/brumate/test/resume.test.ts, for text and an attribute.
- [ ] A rejection of such a memo reaches the nearest `#catch`, reported once.
- [ ] A patch changeset for brumate.

## Sizing

S: one compile-time check and its tests.
