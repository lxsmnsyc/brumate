---
id: dynamic-spread-handlers
title: A dynamic tag keeps the handlers of a spread in the browser
status: todo
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "keeps the handlers of a spread"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - packages/brumate/test/render/dynamicKeys.brm
shared:
  - packages/brumate/test/resume.test.ts
  - packages/brumate/src/runtime/client.ts
reserves: []
provides: []
depends_on: []
---

# A dynamic tag keeps the handlers of a spread in the browser

## Goal

A dynamic tag that the browser renders writes the attributes of a spread without their handlers, so it gets no `b-on` and a `$handler` from a spread never runs. `dynamic` and `dynamicNodes` write the `b-on` of the spread, as a plain element does.

## Context

- The cause, the fixtures and the failing test are in [reviews/core-gaps.md](../../reviews/core-gaps.md), section 4. Use them as they are, and see the test fail before the fix.
- Found by as-collections (#252), whose change request was rejected so the core is fixed instead.

## Acceptance

- [ ] The test of reviews/core-gaps.md section 4 fails on main and passes with the fix.
- [ ] The packages/brumate suite passes, and the gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one change in two functions of the client runtime.
