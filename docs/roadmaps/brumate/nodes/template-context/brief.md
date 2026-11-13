---
id: template-context
title: A #template that a child calls reads the context of its caller in the browser
status: todo
priority: should
type: fix
story:
early: false
outline: true
milestone: 0.8.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-12
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

# A #template that a child calls reads the context of its caller in the browser

## Goal

The server reads the caller's context in a `#template` a child calls. The browser render reads it from the scope where the template is defined. Pass the calling scope, and remove the `template-context` cause from `packages/brumate/test/differential/data.ts`.

## Context

- Item 7 of the client audit (docs/roadmaps/brumate/nodes/client-audit/outcome.md). The page is `tplContextListPage`.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
