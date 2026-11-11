---
id: key-letter-case
title: A key with a modifier matches the letter in either case
status: active
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.7.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-11
spent:
owns: []
shared:
  - packages/brumate/src/runtime/boot.ts
  - packages/brumate/src/runtime/events.ts
  - packages/brumate/test/**
  - website/docs/markup.md
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A key with a modifier matches the letter in either case

## Goal

`prevent(handler, 'Mod+K')` matches Cmd+K and Ctrl+K. Today `keyMatches` (packages/brumate/src/runtime/boot.ts:206) compares `event.key` exactly, and the browser sends `k` for Cmd+K, so `'Mod+K'` type-checks (`KeyName` in runtime/events.ts:75 allows `Uppercase<Letter>`) but only matches Cmd+Shift+K: a silent no-op.

## Context

- Found in the context-menu review (2026-11-11). Same code on main and release/0.8.
- Repro: `<div onKeyDown=(prevent(handler, 'Mod+K'))>`; Cmd+K does not prevent the default, Cmd+Shift+K does.
- @brumate/ui's new `DialogTrigger shortcut` (context-menu node, 0.8.0) matches letters in either case and treats Shift as not counted; use the same rule so both agree.

## Acceptance

- [ ] A test that fails on main: `'Mod+K'` matches a keydown with `key: 'k'` and `metaKey`/`ctrlKey`.
- [ ] Single letters without a modifier keep their case rule as documented (check website/docs/markup.md and decide with the code; say which in the outcome).
- [ ] Docs line in markup.md. Patch changeset for `brumate`.
- [ ] `pnpm exec oxlint`, `pnpm format:check`, `pnpm typecheck`, brumate tests for events.
