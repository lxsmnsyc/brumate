---
id: client-audit
title: "Spike: a structural audit of the client runtime, ranked removals"
status: done
priority: should
type: spike
outline: false
milestone: 0.7.0
target: next
from:
size: M
spike: true
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-03
spent: 300000
owns:
  - packages/brumate/test/audit/**
shared: []
reserves: []
provides: []
depends_on:
  - on: values-spike
    kind: hard
    why: its outcome measures what one write path would replace, and its no-go is why this audit runs
---

# Spike: a structural audit of the client runtime, ranked removals

## Goal

The maintainer asked whether the client can be simplified without the rewrite that values-spike tested (no-go, 2026-11-03). Map the browser runtime (packages/brumate/src/runtime/client/** and runtime/client.ts) and the client codegen that feeds it, and propose removals ranked by what each saves. No code merges from this node; the outcome is the list, and the maintainer picks which become nodes.

## Questions

1. Map the client by responsibility: resume, browser render (cloned templates, fills), the update queue (`g`, `pass`, `queueWrite`, `drain`), holds and waits (waits.ts), errors and `#try`, lists, navigation, code loading. Lines, exports and feature flags for each.
2. List the branches that exist for only one path (browser render, resume, update) or only during a hold, and the branches no test reaches (coverage of `pnpm --filter brumate test`).
3. For each of the 11 special-case causes in the differential test (packages/brumate/test/differential*, nodes/differential-render-test/outcome.md), the code that causes it and what removing it takes.
4. The 20 bodies that still render from an HTML string (test/clone-bodies.test.ts) and what clone-remaining-bodies removes.
5. A ranked list of removals: for each, the lines and exports removed, divergences fixed, the risk, a size (S or M), and the todos gzip delta where it can be measured cheaply. Group what belongs in one node.

## Context

- values-spike's outcome (nodes/values-spike/outcome.md): removing all the code one write path would replace saves only about 0.85 kB, so the complexity is in special cases, not in duplicated bytes.
- Use the perf-pass skill's structural analysis. Keep the result to measured facts; mark an estimate as one.
- Probes and scripts go in packages/brumate/test/audit/ or the node folder, not into the runtime.

## Acceptance

- [ ] The outcome answers questions 1 to 5, with the commands that produced each number.
- [ ] A ranked list the maintainer can turn into nodes, with the top items sized.

## Sizing

M: time-boxed to two days, about 0.3M tokens.
