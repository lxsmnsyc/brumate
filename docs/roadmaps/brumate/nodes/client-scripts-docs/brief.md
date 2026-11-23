---
id: client-scripts-docs
title: Docs: vite dev serves pages, scripts are a default
status: todo
priority: 
type: docs
story: client-scripts
early: false
outline: false
milestone: 
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: 
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - website/docs/getting-started.md
  - website/docs/reference-plugin.md
shared:
  - website/docs/deploying.md
  - packages/brumate/skill/**
reserves: []
provides: []
depends_on:
  - on: examples-glue
    kind: hard
    why: the docs show the examples as they end up
---

# Docs: vite dev serves pages, scripts are a default

## Goal

- getting-started "Serve pages in development" becomes: run `vite dev`. The own-server code moves to deploying.md as the advanced path, with `brumate/node` and no `scripts`.
- deploying.md: the production server uses `brumate/node` and no manifest read; one paragraph says `scripts` overrides the default (for example a nonce or `''`).
- reference-plugin: `appType: 'custom'` default, the `middlewareMode` and Nitro skips, the warning for `spa`/`mpa`.
- The brumate skill: no hand-written script tags in its server examples.

## Acceptance

- [ ] The guard test of examples-glue passes with the new docs.
- [ ] Writing follows the plain-writing skill.

## Sizing

S: three doc pages and the skill.
