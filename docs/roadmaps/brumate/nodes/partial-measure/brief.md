---
id: partial-measure
title: Measure a docs navigation, bytes and time
status: active
priority: must
type: chore
story: partial-route-responses
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: node benchmarks/navigation/run.mjs --check
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - benchmarks/navigation/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Measure a docs navigation, bytes and time

## Goal

A script that loads the built website, clicks one link between two docs pages that share layouts, and records the transfer size of the navigation response (raw and gzip) and the milliseconds from the click to the end of the swap. It writes the baseline numbers of main to `outcome.md`, so the story can show before and after.

## Context

- The swap ends in `replaceRoutes` (`packages/brumate/src/runtime/navigate.ts:214`). With `DEV` the loader already has a `report` hook (`:660`); a production build has none, so measure with `PerformanceObserver` (`navigation` is not used by `fetch`; use `resource` entries for the response, and `performance.mark` around the click and the `brumate:navigate` end through a MutationObserver on the new route).
- Use the website docs routes `/docs/styles` and `/docs/context`, and one pair with a deeper layout (the `@sidebar` slot). Build with `pnpm --filter website build` and serve the output with the repo's static preview. The e2e runner (`e2e/lib.mjs`) has Playwright helpers.
- Evidence to keep: the commit, the browser version, CPU throttle off, 20 runs, median and p90.

## Acceptance

- [ ] `node benchmarks/navigation/run.mjs` prints a table: bytes raw, bytes gzip, time to swap, for each pair, as median of 20 runs.
- [ ] `--check` runs once, asserts both numbers are positive and that the swap was partial or full as the flag says (`--expect full` today), and exits 0.
- [ ] The baseline is in `outcome.md` with the commit.
- [ ] Fast check passes: `node benchmarks/navigation/run.mjs --check`

## Sizing

M: a new harness, a build and a browser, one measurement that must be stable.

## Notes for the worker

- Do not run the full benchmark suite (`pnpm bench`); this is its own small script.
- Warm the browser cache of the page's JS first; the number is about the navigation response.
