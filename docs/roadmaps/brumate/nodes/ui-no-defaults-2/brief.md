---
id: ui-no-defaults-2
title: "ui contexts without defaults, group 2"
status: active
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
  - on: ui-no-defaults-1
    kind: hard
    why: the ui groups share files under packages/ui/src; one worker at a time
---

# ui contexts without defaults, group 2

## Goal

From the approved debate docs/debates/context-no-defaults/debate.md: packages/ui has about 40 contexts with a default (`null`, `store(null)`, `{ state: store(null) }`, `noInput`, `false`), read through 129 `$store` and 76 `$getContext` calls in about 80 files. This node moves group 2: first LocaleContext and the layer context (popover, tooltip, modal, menu, preview), which make most ui test files fail after group 1 (see ui-no-defaults-1's outcome), then the fields: Input, TextArea, the field parts, Form, CheckboxGroup, RadioGroup, FieldError, FieldInput. LocaleContext gets no default: its readers fall back to the en-US locale per reader, replacing store-repair-compare's plan to restore a default store. Pick the files at the start and list them in the outcome, so the next group knows what is left.

Each `createContext` loses its default. A part that must work without a provider reads with `$hasContext(C) ? $store(C) : undefined` or the `$getContext` form (see has-context's outcome). A fallback value is built in the reader, never at module scope.

## Acceptance

- [ ] No `createContext` in this group's files passes a default; every part that rendered alone still renders alone (ui tests that mount it with no provider).
- [ ] ui tests and `node e2e/run.mjs --only ui` pass.
- [ ] The ui example's client JS (gzip -9 summed over examples/ui dist JS) before and after.

## Sizing

M: about 20 files of mechanical changes.
