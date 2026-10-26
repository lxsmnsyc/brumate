---
id: split-client-runtime
title: Split the client runtime by feature
status: todo
priority: must
type: refactor
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run
exclusive: [bench]
fulfilled_by: 
gate: true
added:
owns:
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/client/**
shared: []
reserves: []
provides: []
depends_on:
  - on: scope-id-table
    kind: hard
    why: it edits client.ts
---

# Split the client runtime by feature

## Goal

Move client.ts (4,700 lines) into modules by feature, such as updates, blocks, children, templates, handlers and resume, with client.ts re-exporting them. The behavior and the bundle size do not change.

## Context

- Every core node of this roadmap and of client-size edits client.ts, so they collide. A split lets them own their own modules.
- Source: Split hot files by feature first, from the parallel-roadmap skill

## Acceptance

- [ ] No test changes, and all pass: `pnpm test`.
- [ ] The gzip size of the core for todos does not grow: `pnpm bench`.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a large move with no change of behavior. Gated, since the user decides the layout.
