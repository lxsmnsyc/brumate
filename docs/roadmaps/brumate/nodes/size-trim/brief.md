---
id: size-trim
title: Bring the client size back near the baseline
status: done
priority: must
type: refactor
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify: pnpm bench
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-10-27
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/shared.ts
  - packages/brumate/src/runtime/serial.ts
  - packages/brumate/src/codegen/**
  - docs/performance.md
reserves: []
provides: []
depends_on:
  - on: size-baseline
    kind: hard
    why: it needs the baseline to measure against
  - on: batching
    kind: hard
    why: batching rewrites updates.ts, which holds most of the growth
---

# Bring the client size back near the baseline

## Goal

The gzip JS before `load` for todos (`pnpm bench`) comes back to within 0.1 kB of the size-baseline number, or the outcome says what each remaining byte buys. The core work of 2026-10-26 and 27 went over its budgets: the merged handlers (+174 B unminified, component-tag-live-props), spread-children-live (+83 B), ordered-updates (+335 B against 300 B, accepted to be trimmed later).

## Context

- Measure each chunk against the baseline, and list the largest additions by function (updates.ts queue and levels, mergeHandlers and PARTS in shared.ts, the children record in serial.ts).
- No change of behavior: the brumate and ui suites and e2e pass unchanged.
- handler-merge-trim (smaller-client) covers the merged handlers; fold it in if it is still open, and mark it fulfilled.
- Do not make a write slower: rerun the rows probe of the reviews of #282 (1000/4000/10000 rows).

## Acceptance

- [ ] docs/performance.md has the size before and after, against the baseline.
- [ ] The full check passes: `pnpm build && pnpm test && node e2e/run.mjs`.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: many small cuts across the client modules, each measured.
