---
id: ui-stores-calendar
title: The calendar, date and color parts read live context values from stores
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

# The calendar, date and color parts read live context values from stores

## Goal

A wave of step 3 of the approved context-stores debate (docs/debates/context-stores/debate.md): in the calendar, date and color parts, each provider that passes a value that changes puts it in one store per provider, and its readers read it with `$store(ctx)`. Constant values stay plain; a context passed only one level down may become props; context functions stay for handlers only (the debate's P14, P16). Use evidence/count-readers.txt and evidence/setcontext.txt of the debate for the list of calls.

## Acceptance

- [ ] Every reader of a changing value in these parts reads it from a store; the live-context path is no longer needed by them (a test or a dev check shows no `updateContext` call from these parts).
- [ ] The ui tests and the ui e2e suite pass; the parts behave the same.
- [ ] The ui example's JS before `load` is recorded before and after.

## Sizing

M.
