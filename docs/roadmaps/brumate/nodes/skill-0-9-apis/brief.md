---
id: skill-0-9-apis
title: The brumate skill teaches the 0.9 APIs
status: todo
priority: must
type: docs
story:
early: false
outline: true
milestone: 0.9.0
target: 
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
added: 2026-11-12
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: async-effects
    kind: hard
    why: it teaches the API
  - on: produce-map-set
    kind: hard
    why: it teaches the API
  - on: external-scripts
    kind: hard
    why: it teaches the API
  - on: observability
    kind: hard
    why: it teaches the API
  - on: style-scope-where
    kind: hard
    why: it teaches the rule
---

# The brumate skill teaches the 0.9 APIs

## Goal

The brumate skill covers what 0.9.0 adds: async effects, `$produce` with maps and sets, external scripts, `onTrace`, and the specificity of scoped styles. Its tasks (skill-tasks) pass with the new APIs. Same shape as skill-0-8-apis.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
