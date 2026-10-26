---
id: tests-current-build
title: Tests compile with the current compiler
status: done
priority: must
type: chore
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: mv packages/brumate/dist packages/brumate/dist.away; pnpm --filter @brumate/ui exec vitest run; s=$?; mv packages/brumate/dist.away packages/brumate/dist; exit $s
exclusive: []
fulfilled_by: "#248"
gate: false
added: 
owns:
  - packages/ui/vitest.config.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Tests compile with the current compiler

## Goal

The tests of @brumate/ui compile components with brumate from its source, not from packages/brumate/dist, so a stale dist cannot hide a change of the compiler.

## Context

- On 2026-10-26 a stale dist failed Tree and Table tests, and agent worktrees hit it again.
- Source: [Tests against the current build](../../../../proposals.md#tests-against-the-current-build)

## Acceptance

- [x] With packages/brumate/dist deleted, the ui tests still pass.
- [x] `pnpm test` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: two configs.

## Notes for the worker

- The website has no tests yet. docs-generator adds them, with a config that resolves brumate to its source.
