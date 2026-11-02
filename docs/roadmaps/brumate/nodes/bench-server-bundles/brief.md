---
id: bench-server-bundles
title: "The benchmark servers pass the bundles that render() now needs"
status: todo
priority: must
type: fix
outline: false
milestone: 0.5.0
target:
from:
size: S
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-02
spent:
owns: []
shared:
  - benchmarks/brumate/**
  - benchmarks/harness/**
reserves: []
provides: []
depends_on:
  - on: bundle-urls-from-server
    kind: hard
    why: "#425 made a server that calls render() itself pass `bundles`"
---

# The benchmark servers pass the bundles that render() now needs

## Goal

`pnpm bench` on `next` renders pages that name their bundles, so the todos, dashboard and rows clicks work again and the size figures count the app's own code.

## Context

- Found by topological-awaits-server on 2026-11-02: the todos bench click checks ("Click to update") fail on feat/browser-async at 793a65d9, and main's pass. Likely cause: since bundle-urls-from-server (#425, on `next`), a server that calls `render()` or `renderToStream()` itself must pass `bundles`, and benchmarks/brumate/src/server.ts (and the dashboard and rows servers) pass none. Not confirmed.
- Confirm on `next` first. Then check whether the todos and dashboard sizes recorded since #425 (13.5 kB, 22.9 kB) missed the app bundle, and record the corrected figures.
- The examples that render on their own (examples/_/src/server_.ts) may have the same gap; check them too.

## Acceptance

- [ ] `pnpm bench --only brumate` passes its click checks on `next`, for todos, dashboard and rows.
- [ ] The corrected todos and dashboard sizes in outcome.md, against the figures #425 reported.
- [ ] Any example server with the same gap fixed, with a test or e2e step.

## Sizing

S: pass the bundles in a few servers, rerun the bench.
