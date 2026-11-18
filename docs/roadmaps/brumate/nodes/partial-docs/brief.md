---
id: partial-docs
title: Document partial responses and record the numbers
status: todo
priority: must
type: docs
story: partial-route-responses
early: false
outline: false
milestone: 0.9.0
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
added: 2026-11-18
spent:
owns:
  - website/docs/routing.md
shared:
  - docs/decisions.md
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: partial-prefetch
    kind: behavior
    via: partial-route-response
  - on: partial-fallbacks
    kind: behavior
    via: partial-route-response
  - on: partial-measure
    kind: hard
    why: the final numbers come from its script and its baseline
---

# Document partial responses and record the numbers

## Goal

Tell users how a link navigation works now (the header, the full page fallbacks, caching, prefetch), record the decisions, and add the after numbers of the story.

## Context

- Docs page: the routing and navigation page of `website/docs` (check the file name; `routing.md` is assumed).
- Run `partial-measure`'s script on the story branch and write the table (bytes raw and gzip, time to swap, before and after) in this node's `outcome.md`, with the commit.
- A minor changeset for the request header and the loader change.

## Acceptance

- [ ] The docs page states: kept layouts are not sent, forms and reloads get full pages, and a proxy must pass `x-brumate-keep` and honor `Vary`.
- [ ] `docs/decisions.md` has one entry for the story (header, silent layouts, cache and prefetch answers).
- [ ] `outcome.md` has the before and after table and says whether the target (at most 50% of the bytes, no slower swap) was met.
- [ ] A minor changeset exists.

## Sizing

S: docs, one measurement run.

## Notes for the worker

- Plain, short sentences. Numbers come from the script, not from memory.
