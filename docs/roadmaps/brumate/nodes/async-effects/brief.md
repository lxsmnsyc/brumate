---
id: async-effects
title: Async callbacks in $effect and $client
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

# Async callbacks in $effect and $client

## Goal

`$effect(async () => { ... })` and an async `$client` callback compile. The compiler calls `asyncEffect` for them, so a page without one loads no code for it, and `BRM096` goes. The five rules of the proposal hold: a stale run cleans up when it settles, one run at a time, a scope that goes does not wait, a rejection reaches `fail(scope, error)`, and the cleanup may be a function, an async function or a disposable.

## Context

- Source: [Async effects](../../../../proposals.md#async-effects), with its test list and "To check" items.
- Before refining, read how Svelte 5 (`$effect` rejects async), Solid 2.0 (split compute and effect) and Vue (`watchEffect` with `onCleanup`) handle async setup and cleanup, at a pinned SHA, and compare each rule against them.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
