---
id: loader-preload-spike
title: "Spike: fold the loader into the core and drop Vite's preload helper"
status: todo
priority: could
type: spike
outline: false
milestone: 0.5.0
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
    kind: soft
    why: option D of its report is the starting point
---

# Spike: fold the loader into the core and drop Vite's preload helper

## Goal

A todos page loads five files: the loader (boot.ts plus Vite's preload helper), the core, a re-export of the core, `events`, and the app. Find out whether brumate can load fewer files and drop the preload helper, without breaking the CSS preload of lazy bundles.

## Context

- perf-pass-0.4 option D: removing the preload helper from the loader chunk saves about 0.68 kB gzip (4.4%) on todos. Simulated by editing the built chunk, not run in a browser.
- The brumate Vite plugin already returns no dependencies for the core; the helper stays for `defer` and bundle imports that brumate also lists in `hints.json`.
- The 387 B core re-export and the 249 B `events` chunk cost one request each.
- Marko 6 ships the todos page as one file.

## Questions

1. Does Vite or Rolldown have a switch to skip the helper for given imports, or does it need a `renderChunk` rewrite?
2. Can the loader be part of the core chunk, and what does a page that needs no code pay then?
3. How are the CSS files of lazy bundles preloaded without the helper?

## Acceptance

- [ ] outcome.md with the measured gzip and request counts on todos, dashboard and rows, run in a browser, and a go or no-go.
- [ ] Gate: the maintainer decides go or no-go.

## Sizing

S: time-boxed to one day.
