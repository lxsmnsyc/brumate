---
id: memo-prop-browser-child
title: $memo of a promise prop loads in a child that the browser renders
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
reserves: []
provides: []
depends_on:
  - on: promise-prop-memo
    kind: hard
    why: it changes how a promise prop reaches the child (plain promise, components.ts and props.ts); this fix builds on it
---

# $memo of a promise prop loads in a child that the browser renders

## Goal

Found by promise-prop-memo (#373, 2026-10-30), also on main: in a child component that the browser renders (inside `#if`, `#for` or another block that the browser builds, not a resumed server render), `$memo(user)` of a promise prop does not load the promise, so the memo never settles and `#loading` never shows the value. Since #373, `$memo(prop)` is the documented way to read a promise prop as a pending-aware value, so it must work in every child.

Probe first against main: the smallest page with a `#if` that renders a child after load, passing a promise prop that the child reads through `$memo` under `#loading`. Then fix it in the client runtime.

## Acceptance

- [ ] A test: a browser-rendered child shows empty text while pending, then the value of `$memo(user)`; a rejected promise shows `#catch`. It fails on main. (The `#loading` fallback in browser-rendered markup moved to browser-loading-fallback, 0.5.0; the maintainer, 2026-10-30.)
- [ ] The resumed case from #373 still passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one path in the client runtime and a test.
