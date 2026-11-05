---
id: ui-store-guards
title: ui readers drop the guards that $store no longer needs
status: todo
priority: must
type: refactor
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared:
  - packages/ui/src/**
  - packages/ui/test/**
  - packages/ui/e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: store-any-source
    kind: hard
    why: the shorter reads need $store to take an optional source
---

# ui readers drop the guards that $store no longer needs

## Goal

packages/ui calls `$hasContext` 205 times after the ui-no-defaults nodes, often twice per reader: `const g = $hasContext(C) ? $getContext(C) : undefined; const s = $hasContext(C) ? $store(g.state) : undefined;`. With store-any-source, the second guard goes: `const s = $store(g?.state)`. Rewrite every such reader; keep one `$hasContext` per context read. Behavior with and without a provider must not change.

## Acceptance

- [ ] No ui reader guards a `$store` whose source is already optional; `$hasContext` count before and after.
- [ ] ui tests and `node e2e/run.mjs --only ui` pass.
- [ ] The ui example's client JS before and after (ui-no-defaults added 241 B gzip; record how much comes back).
- [ ] A changeset only if the public behavior changes; otherwise none.

## Sizing

M: mechanical, about 80 files.
