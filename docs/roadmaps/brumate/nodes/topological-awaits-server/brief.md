---
id: topological-awaits-server
title: The server starts each awaited memo as early as its inputs allow
status: todo
priority: should
type: feature
story:
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
  - packages/brumate/test/render/**
  - docs/decisions.md
shared:
  - packages/brumate/src/runtime/server.ts
reserves: []
provides: []
depends_on:
  - on: browser-await-spike
    kind: hard
    why: the spike designed the start rule, and the maintainer took it for the server at the gate
---

# The server starts each awaited memo as early as its inputs allow

## Goal

Today the server starts the loads of a run of adjacent `await $memo` declarations together, and any other statement ends the run, so an independent memo after it waits for no reason. Move the start of each awaited memo's load to right after the last plain statement it reads (`$$b.start($$p_x)`, about 30 B). Each `await` still waits where it is written, and `waitAll` stays.

## Context

- The maintainer took the rule for the server on 2026-11-01, so the browser (browser-await-blocks) and the server agree. Share the analysis of which names a memo reads with browser-await-blocks: whichever lands second reuses the first's function.
- Reword docs/decisions.md:27 ("A run of `await $memo` declarations loads at the same time").
- Not in the story: it changes the server only and ships on its own to `next`.
- See [browser-await-spike outcome](../browser-await-spike/outcome.md), "Topological awaits".

## Acceptance

- [ ] Two independent awaits separated by a plain statement start together on the server (a render test counts the overlap); statement order and side effects do not change.
- [ ] decisions.md:27 states the new rule.

## Sizing

S: one codegen change, a small runtime helper and tests.
