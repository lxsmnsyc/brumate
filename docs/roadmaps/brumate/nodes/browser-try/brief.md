---
id: browser-try
title: "A #try that the browser renders catches a rejected wait"
status: todo
priority: must
type: fix
story: browser-async
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-01
spent:
owns:
  - packages/brumate/src/codegen/**
  - packages/brumate/test/resume.test.ts
shared:
  - packages/brumate/src/runtime/client/**
reserves: []
provides: []
depends_on:
  - on: browser-await
    kind: contract
    via: client-pending-boundary
---

# A #try that the browser renders catches a rejected wait

## Goal

In client mode `#try` compiles to an inline try/catch and the module has no `t` table entry for it, so `fail(scope, error)` from a rejected wait, or a throw in the rest of a render, reports the error as unhandled. Give a browser-rendered `#try` a `t` entry or a runtime boundary, so the error renders its `#catch`.

## Context

- Found by the review of browser-await-spike (#411). See [browser-await-spike outcome](../browser-await-spike/outcome.md).

## Acceptance

- [ ] A component that awaits a rejected memo inside a `#try` in an `#if` shows the `#catch` body.
- [ ] A throw in the rest of a render after a wait shows the `#catch` body.
- [ ] Todos gzip: 0 B change (todos has no `#try`).

## Sizing

S: one compiler path and its tests.
