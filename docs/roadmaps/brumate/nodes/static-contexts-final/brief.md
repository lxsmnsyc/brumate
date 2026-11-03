---
id: static-contexts-final
title: Every context is static: delete the live-context path
status: todo
priority: should
type: refactor
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent:
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - .changeset/*.md
  - website/docs/context.md
reserves: []
provides: []
depends_on:
  - on: ui-stores-fields
    kind: hard
    why: every part reads live values from stores first
  - on: ui-stores-calendar
    kind: hard
    why: every part reads live values from stores first
  - on: ui-stores-collections
    kind: hard
    why: every part reads live values from stores first
---

# Every context is static: delete the live-context path

## Goal

The last step of the approved context-stores debate (docs/debates/context-stores/debate.md): remove the live-context path (graph.ts and analyze.ts no longer treat a `context` declaration as live, codegen no longer emits the update part that calls `$$b.updateContext`, and the runtime drops it). `$route()` and `$navigation()` stay runtime contexts. Development logs once when a static context value changes.

## Acceptance

- [ ] No client output calls `updateContext`; `$route` and `$navigation` still update their readers.
- [ ] Docs and decisions.md say contexts are static.
- [ ] Todos and the ui example: JS before `load` recorded.
- [ ] A minor changeset (a 0.x break).

## Sizing

S.
