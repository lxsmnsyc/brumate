---
id: context-stores
title: Static contexts, with live values through $store
status: todo
priority: should
type: story
outline: true
milestone: 0.7.0
target: next
from:
size: L
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-03
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

# Static contexts, with live values through $store

## Goal

Every context is static: `$getContext` gives the value as it was set, whatever the value holds, and no context read is live in the browser. A value that changes reaches readers only through a store put into the context: a store contract (`subscribe`, `get`) and `$store` to bind one in a component. The maintainer chose this on 2026-11-03, in place of static-contexts' analysis of which contexts can change (#448, closed).

## Context

- Order matters: the ui parts pass live values through 192 `$setContext` calls today (field state, `isInvalid`, `errors`, `isCurrent`, picker values). They must move to stores before contexts turn static, or they stop updating.
- Parts, refined after the debate: store-lens-spike (the store's shape and cost), store-contract (`$store`), moving the ui parts' live context values to stores, and turning contexts static (graph.ts marks context declarations live today).
- A debate settles the combined design first: docs/debates/context-stores/.
- Expected gain: every context reader drops its update code, not only the ones #448 could prove static (which saved 897 B gzip across the website).

## Acceptance

- [ ] Set by the debate and the refined children.

## Sizing

L: a story of about four nodes.
