---
id: browser-root-boundary
title: "A block outside every #loading holds until its waits settle"
status: todo
priority: must
type: feature
story: browser-async
early: false
outline: false
milestone: 0.5.0
target:
ship: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-01
spent:
owns:
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/runtime/features.ts
  - packages/brumate/src/vite.ts
  - packages/brumate/test/resume.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: browser-await
    kind: hard
    why: it adds hold to the insert sites that wait renders through
---

# A block outside every #loading holds until its waits settle

## Goal

The app counts as wrapped in one `#loading` (the maintainer, 2026-11-01): an `#if` branch or `#for` row outside every `#loading` that waits keeps the current content until its waits settle, as the server holds the page. A first render with nothing to keep shows nothing until its waits settle, as the server sends nothing.

## Context

- Start from the spike's root boundary prototype: `hold` in `branch`, a new `#for` row rendered through `loading` with an empty fallback and an item marker.
- `__BRUMATE_HAS_ROOT_WAIT__` turns it on when a compiled part calls `$$b.wait(`. The flag is per build (`buildFeatures`, vite.ts:684), not per page, and follows imports into packages.
- `hold` at every insert site: the outcome of browser-await-spike lists all 15 and prices them. Spike figures: +191 B gzip on todos with the flag forced on, about +365 B plus the rest of the sites on an app that uses it.
- Open from the re-review of #411 (https://github.com/lxsmnsyc/brumate/pull/411#pullrequestreview-5728815499): with the flag on, `hold` renders the new body before it destroys the old one even when nothing waits, so old cleanups run after the new script. Keep the old order when nothing waits, or document and test the new one. Rapid B, A, B switching ends right but loads twice; avoid the second load if it is cheap.

## Acceptance

- [ ] Outside every `#loading`, an `#if` branch and a `#for` row that wait keep the current content until they settle; switching back during the wait drops the pending body.
- [ ] Cleanup order when nothing waits matches today, or the new order is documented and tested.
- [ ] Todos gzip: 0 B change with the flag off; the cost on an app that uses it is in the outcome.

## Sizing

M: every insert site and the tests.
