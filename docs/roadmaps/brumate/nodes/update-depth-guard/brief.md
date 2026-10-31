---
id: update-depth-guard
title: A runaway update loop throws instead of hanging the tab
status: todo
priority: should
type: feature
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-31
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/error-catalog.ts
  - website/docs/effects.md
reserves: []
provides: []
depends_on: []
---

# A runaway update loop throws instead of hanging the tab

## Goal

When updates keep scheduling more updates past a limit, the client stops and throws into the nearest `#try`, with a message that names the effect or update and points to `$untrack`, as Svelte 5 (`effect_update_depth_exceeded`) and React ("Maximum update depth exceeded") do.

## Context

- The debate function-prop-derivations found no update-depth guard in the client (O1): any loop of an effect that writes what it reads hangs the tab.
- Size comes first: measure todos with `pnpm bench` and stay within 0.3 kB; a counter in the flush loop should cost a few bytes.
- Pick the limit from real pages: the deepest legitimate chain in the ui suite and e2e should stay far below it.

## Acceptance

- [ ] A loop test throws into `#try` with the message; the ui suite and e2e pass.
- [ ] An error catalog entry and a line in effects.md.
- [ ] todos gzip size reported.

## Sizing

S: a counter in the flush loop, an error and a test.
