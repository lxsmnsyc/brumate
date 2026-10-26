---
id: inlining-spike
title: Spike: component inlining and constant folding
status: todo
priority: could
type: spike
target:
from:
size: M
spike: true
verify: 
exclusive: [bench]
fulfilled_by: 
gate: false
added:
owns:
  - docs/roadmaps/client-size/nodes/inlining-spike/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Spike: component inlining and constant folding

## Goal

Find which components the compiler can inline into their parent (no state of their own, no `$client` or `$effect`, props with static values), what happens to scope IDs and the page state, and what folding static props and expressions into the templates saves on the server and the client.

## Context

- The user asked for this on 2026-10-26: low priority, high value.
- Source: Request of the user, 2026-10-26

## Acceptance

- [ ] outcome.md has the rules for which components inline, the measured gain on the website and the examples, and a go or no-go.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: time-boxed to three days.
