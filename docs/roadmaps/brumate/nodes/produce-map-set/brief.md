---
id: produce-map-set
title: $produce warns on, then drafts, maps and sets
status: todo
priority: must
type: feature
story:
early: false
outline: true
milestone: 0.9.0
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
depends_on: []
---

# $produce warns on, then drafts, maps and sets

## Goal

`$produce` on a signal that holds a `Map` or `Set` updates the page. Two steps, in this order: a dev warning when the value cannot be drafted and the recipe returns nothing, then drafts of maps and sets that copy on the first write.

## Context

- Source: [`$produce` with maps and sets](../../../../proposals.md#produce-with-maps-and-sets). Today `packages/brumate/src/runtime/produce.ts` uses a `Map` as it is, so `draft.set(id, tag)` changes it in place and nothing updates.
- Report the bytes the drafts add to a page that calls `$produce`. Immer keeps them behind `enableMapSet`; read Immer and Mutative at a pinned SHA before picking the form.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
