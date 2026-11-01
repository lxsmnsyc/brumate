---
id: website-script-names
title: The website sends the script names map only where a network panel needs it
status: todo
priority: should
type: fix
outline: false
milestone:
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-01
owns: []
shared:
  - website/vite.config.ts
  - website/src/scripts.ts
reserves: []
provides: []
depends_on: []
---

# The website sends the script names map only where a network panel needs it

## Goal

`scriptNames` in website/vite.config.ts (about line 43) inlines `window.__scriptNames`, a map of every chunk file of the build to a readable name, into the head of every page. It is 32 kB raw / 10.1 kB gzip per page (2026-11-01), more than the brumate runtime's loader. Only the network panels of the demos (`[data-network]`, website/src/scripts.ts NETWORK_SCRIPT) read it.

## Context

- Options: inline only the names of the files that page can load (its hints), or fetch the map as a JSON file when a network panel first renders. Pick the smaller one that keeps the panels' names right after a client navigation.
- The website deploys from main, so this targets main.

## Acceptance

- [ ] Pages without a network panel carry no script names map.
- [ ] The home page network strip and the demo panels still show readable names, also after a client navigation.
- [ ] Home page HTML gzip recorded before and after.

## Sizing

S.
