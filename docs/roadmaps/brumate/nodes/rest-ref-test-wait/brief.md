---
id: rest-ref-test-wait
title: The rest-props ref tests wait for the element instead of a fixed time
status: todo
priority: must
type: fix
outline: false
milestone: 0.7.1
target: main
from: 
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent:
owns: []
shared:
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on: []
---

# The rest-props ref tests wait for the element instead of a fixed time

## Goal

The resume tests of a ref left in the rest props pass under load.

## Context

- packages/brumate/test/resume.test.ts, "a ref left in the rest props reaches the element that spreads them" and its cast twin (around line 5587), wait a fixed 300 ms after the click. Under load the first module load misses it: `expected '' to be 'BUTTON'` (release-0.7 outcome, inbox.md 2026-11-07).
- Test-only; no changeset.

## Acceptance

- [ ] The tests wait with `waitFor` (or the file's own wait helper) for the expected value, not a fixed delay.
- [ ] Other fixed waits in the same `describe` that race the same way get the same change.
- [ ] The file passes alone and in the full `pnpm test` run.

## Sizing

S: a test change.
