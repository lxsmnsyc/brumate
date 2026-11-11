---
id: inline-memo-errors
title: An inline memo keeps its error until a read
status: done
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
verify: pnpm --filter brumate exec vitest run test/render.test.ts
exclusive: []
fulfilled_by: 0a494cf5 (batch/brumate-main)
gate: false
added: 2026-11-11
spent: 170000
owns: []
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# An inline memo keeps its error until a read

## Goal

A memo whose expression is a bare array, template, binary or unary expression keeps its error until something reads it, as website/docs/effects.md says ("a memo that nothing reads keeps its error silently"). Today the browser render inlines such a memo (`neverPromise` in codegen), so it throws at its declaration.

## Context

- Found in the render-memo-reads review (2026-11-11). The code (codegen/patch.ts, codegen/primitive.ts, runtime/client/components.ts) is the same on main and release/0.8 (2e1e84f0).
- Repro: a child inside `#try` and `#if (show)` with `let big = $signal(1n); const m = $memo(big + 1); function f() { return [m]; }`, a button that calls `f()`, and no markup read of `m`. When `show` turns true, `#catch` shows "Cannot mix BigInt and other types"; it must render the child, and throw only when `f()` reads `m`.
- These forms can throw by coercion (BigInt mixing, Symbol to string, a throwing `valueOf`/`toString`). render-memo-reads (0.8.0, refactor/render-memo-reads) narrowed `cannotThrow` to forms that cannot coerce; the inline path on main needs the same rule.
- release-0.7.1 merges main into release/0.8; render-memo-reads touches the same code, so the merge resolves to its narrower rule.

## Acceptance

- [ ] A browser-render test that fails on main: the repro above renders the child, and reading `m` from `f()` throws to `#catch`.
- [ ] The server render agrees (differential test or a server test of the same page).
- [ ] Patch changeset for `brumate`.
- [ ] `pnpm exec oxlint`, `pnpm format:check`, `pnpm typecheck`, full brumate vitest.
