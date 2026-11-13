---
id: resume-test-races
title: Resume tests that race, and a test of a skew reload
status: todo
priority: should
type: fix
story:
early: false
outline: true
milestone: 0.8.0
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
added: 2026-11-12
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: release-0.8
    kind: hard
    why: it branches from `main` after the 0.8.0 promotion
---

# Resume tests that race, and a test of a skew reload

## Goal

Three tests of `packages/brumate/test/resume.test.ts` fail now and then, and one acceptance item of bundle-urls-from-server has no test.

- "reads a memo created in the browser as pending until its first load lands" saw `['handler', 'Ada']` on Node 22: the load can land before `.read` shows.
- "shows a pending memo of a promise prop as empty text in a textarea" saw an empty textarea on Node 24: the test reads the value once. Find out whether the test races or a value write is late; a late write is a bug to fix here.
- "a dynamic tag that spreads the rest props > gives the element of a component in as, and of an element after as changes" fails locally (`expected '' to be 'none'`) and passes in CI.
- Add a test of a skew reload for the server-named bundles: a page built against an older deploy reloads.

## Context

- From inbox.md, entries of 2026-11-02, 2026-11-03 and 2026-11-05. Time-box the hunt: compare with the base a few times, do not loop the suite.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it.
