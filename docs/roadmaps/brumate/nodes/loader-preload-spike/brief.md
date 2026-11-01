---
id: loader-preload-spike
title: "Spike: fold the loader into the core"
status: todo
priority: could
type: spike
outline: false
milestone: 0.6.0
target:
from:
size: S
spike: true
verify:
exclusive: [bench]
fulfilled_by:
gate: true
added: 2026-10-30
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: perf-pass-0.4
    kind: hard
    why: option D of its report is the starting point
  - on: drop-preload-helper
    kind: hard
    why: the helper is removed there (0.4.1); this spike measures the loader without it
---

# Spike: fold the loader into the core

## Goal

A todos page loads five files: the loader (boot.ts plus Vite's preload helper), the core, a re-export of the core, `events`, and the app. Find out whether brumate can load fewer files. Dropping the preload helper moved to drop-preload-helper (0.4.1, the maintainer, 2026-11-01).

## Context

- perf-pass-0.4 option D: removing the preload helper from the loader chunk saves about 0.68 kB gzip (4.4%) on todos. Simulated by editing the built chunk, not run in a browser.
- The brumate Vite plugin already returns no dependencies for the core; the helper stays for `defer` and bundle imports that brumate also lists in `hints.json`.
- The 387 B core re-export and the 249 B `events` chunk cost one request each.
- Marko 6 ships the todos page as one file.

## Questions

1. Can the loader be part of the core chunk, and what does a page that needs no code pay then?
2. Can the core re-export and the `events` chunk be folded in, and what does that save in requests and bytes?

## Acceptance

- [ ] outcome.md with the measured gzip and request counts on todos, dashboard and rows, run in a browser, and a go or no-go.
- [ ] Gate: the maintainer decides go or no-go.

## Sizing

S: time-boxed to one day.
