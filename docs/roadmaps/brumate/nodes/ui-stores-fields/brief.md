---
id: ui-stores-fields
title: The field and form parts read live context values from stores
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
added: 2026-11-03
spent:
owns: []
shared:
  - packages/ui/src/**
  - packages/ui/test/**
  - packages/ui/e2e/**
  - examples/ui/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: store-contract
    kind: hard
    why: the parts move onto `$store`
---

# The field and form parts (labels, inputs, errors, groups, form) read live context values from stores

## Goal

A wave of step 3 of the approved context-stores debate (docs/debates/context-stores/debate.md): in the field and form parts (labels, inputs, errors, groups, form), each provider that passes a value that changes puts it in one store per provider, and its readers read it with `$store(ctx)`. Constant values stay plain; a context passed only one level down may become props; context functions stay for handlers only (the debate's P14, P16). Use evidence/count-readers.txt and evidence/setcontext.txt of the debate for the list of calls.

The API is the one store-contract shipped (read its outcome on `feat/context-stores`: docs/roadmaps/brumate/nodes/store-contract/outcome.md). A provider builds a store with `$toStore(signalOrMemo)` as a leaf or key of its `$setContext` value; a reader uses `$store(Ctx)` or, for a context that holds handlers and stores, `$store(field.state)` on a `$getContext` value. A reader that writes back uses `let` (the store must come from `$toStore(signal)`). The compiler now warns when a `$setContext` value reads a local `$signal`, `$memo` or `let`; every such warning in these parts should be gone when the node is done.

## Acceptance

- [ ] Every reader of a changing value in these parts reads it from a store; the live-context path is no longer needed by them (a test or a dev check shows no `updateContext` call from these parts).
- [ ] The ui tests and the ui e2e suite pass; the parts behave the same.
- [ ] The ui example's JS before `load` is recorded before and after.

## Sizing

M.
