---
id: perf-pass-0.4
title: Perf pass on 0.4.0, benchmarked against Marko 6 and brumate 0.3.0
status: done
priority: should
type: chore
outline: false
milestone: 0.4.0
target:
from:
size: M
spike: false
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-10-30
owns:
  - benchmarks/brumate-0.3/**
shared:
  - benchmarks/harness/**
  - benchmarks/README.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: streamed-loading-errors
    kind: hard
    why: it changes the core and its size; measure the release as it ships
  - on: memo-prop-browser-child
    kind: hard
    why: it changes codegen and the client; measure the release as it ships
  - on: shared-part-imports
    kind: hard
    why: it changes the client parts that the benchmarks load
---

# Perf pass on 0.4.0, benchmarked against Marko 6 and brumate 0.3.0

## Goal

Before changeset-review, measure what 0.4.0 costs and where there is room, with the perf-pass skill. Asked by the maintainer on 2026-10-30.

1. Baseline: `pnpm bench` (todos, dashboard, rows; dist, browser, ssr-size, ssr-speed, waterfall) for brumate on main, Marko 6 (benchmarks/marko) and brumate 0.3.0.
2. brumate 0.3.0: add `benchmarks/brumate-0.3`, a copy of benchmarks/brumate that installs `brumate@0.3.0` from npm instead of `workspace:*`, so the harness discovers it. Port the apps only as far as 0.3.0 needs (syntax that 0.4.0 added); note every change, since the apps must stay the same page.
3. Profile where the bytes and the time go on 0.4.0 (bundle analysis of the client core and parts; CPU profile of SSR and of the rows clicks). List the top costs with their share. Compare with 0.3.0: what grew and why (this release added streamed memo reads, cancelWhen, b-html, promise props, streamed `#catch`, kept-value change events and more).
4. Propose at least three candidate size or speed changes from the profile, try the promising ones side by side in worktrees with `bench.py` (runtime) or `size_diff.py` (size), and pick by gain for cost. Correctness first: every option passes the tests.
5. Report: the comparison tables (0.4.0 vs 0.3.0 vs Marko 6), the profile, the options with their measured results and verdicts. Gate: the maintainer chooses which options to build; each chosen option becomes its own PR (or a node), not part of this report PR.

## Context

- The README's Results section (benchmarks/README.md) is from 2026-10-22, before 0.4.0 work; update it with the new run.
- Run benchmarks one at a time on a quiet machine (exclusive: bench). Other agents add noise; note the load average with each run.
- Budgets used through this release: +0.3 kB gzip per PR on todos.

## Acceptance

- [ ] benchmarks/brumate-0.3 builds and runs in `pnpm bench`, with the ported changes listed.
- [ ] A report in nodes/perf-pass-0.4/outcome.md with the three-way tables, the top costs, and the measured options with verdicts.
- [ ] benchmarks/README.md Results updated from the new run.
- [ ] The maintainer has picked the options to build (gate).

## Sizing

M: one benchmark app copy, one full run, profiles, two to four measured options.
