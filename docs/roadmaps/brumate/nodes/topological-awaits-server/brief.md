---
id: topological-awaits-server
title: The server starts each awaited memo as early as its inputs allow
status: todo
priority: must
type: feature
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
  - packages/brumate/test/render/**
shared:
  - packages/brumate/src/runtime/server.ts
reserves: []
provides: []
depends_on:
  - on: browser-await-spike
    kind: hard
    why: the spike designed the start rule, and the maintainer took it for the server at the gate
  - on: browser-await
    kind: hard
    why: browser-await rewords docs/decisions.md:27 first; this node adds the start rule to it
---

# The server starts each awaited memo as early as its inputs allow

## Goal

Today the server starts the loads of a run of adjacent `await $memo` declarations together, and any other statement ends the run, so an independent memo after it waits for no reason. Move the start of each awaited memo's load to right after the last statement that declares or writes anything it reads (including `q = x`, a call such as `params.set()`, and a hoisted local function it calls, which would otherwise throw a TDZ `ReferenceError`) (`$$b.start($$p_x)`, about 30 B). Each `await` still waits where it is written, and `waitAll` stays.

## Context

- The maintainer took the rule for the server on 2026-11-01, so the browser (browser-await-blocks) and the server agree. Share the analysis of which names a memo reads with browser-await-blocks: whichever lands second reuses the first's function.
- `start` catches a rejection, and a synchronous throw of the compute that `ready` rethrows, where the load starts.
- `$effect`, `$client`, imports and type declarations end a run today (markup.ts:748) though they emit nothing on the server; test that they no longer do.
- Reword docs/decisions.md:27 after browser-await's rewording ("A run of `await $memo` declarations loads at the same time").
- A child of browser-async (moved in on 2026-11-01: a node outside the story cannot build on the spike or on browser-await until the whole story merges). It changes the server only.
- See [browser-await-spike outcome](../browser-await-spike/outcome.md), "Topological awaits".

## Acceptance

- [ ] Two independent awaits separated by a plain statement start together on the server (a render test counts the overlap); statement order and side effects do not change.
- [ ] decisions.md:27 states the new rule.

## Sizing

S: one codegen change, a small runtime helper and tests.
