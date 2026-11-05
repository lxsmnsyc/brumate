---
id: ui-no-defaults-4
title: "ui contexts without defaults, group 4"
status: todo
priority: must
type: refactor
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared:
  - packages/ui/src/**
  - packages/ui/test/**
  - packages/ui/e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: ui-no-defaults-3
    kind: hard
    why: the ui groups share files under packages/ui/src; one worker at a time
---

# ui contexts without defaults, group 4

## Goal

From the approved debate docs/debates/context-no-defaults/debate.md: packages/ui has about 40 contexts with a default (`null`, `store(null)`, `{ state: store(null) }`, `noInput`, `false`), read through 129 `$store` and 76 `$getContext` calls in about 80 files. This node moves group 4: the rest: Calendar, DatePicker, color parts, Disclosure, Dialog, overlays, Breadcrumb (LocaleContext and the layer context moved to group 2 on 2026-11-05). Pick the files at the start and list them in the outcome, so the next group knows what is left.

Each `createContext` loses its default. A part that must work without a provider reads with `$hasContext(C) ? $store(C) : undefined` or the `$getContext` form (see has-context's outcome). A fallback value is built in the reader, never at module scope.

## Acceptance

- [ ] No `createContext` in this group's files passes a default; every part that rendered alone still renders alone (ui tests that mount it with no provider).
- [ ] ui tests and `node e2e/run.mjs --only ui` pass.
- [ ] The ui example's client JS (gzip -9 summed over examples/ui dist JS) before and after.
- [ ] No `createContext` in packages/ui passes a default; `pnpm typecheck` passes for the whole repo.

## Sizing

M: about 20 files of mechanical changes.
