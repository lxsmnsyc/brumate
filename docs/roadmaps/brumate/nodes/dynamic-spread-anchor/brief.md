---
id: dynamic-spread-anchor
title: A forwarded ref survives a spread on a component
status: done
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "spreads its props"
exclusive: []
fulfilled_by: "#255"
gate: false
added: 2026-10-26
owns:
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/html.ts
  - packages/brumate/test/render/RefSpread.brm
  - packages/brumate/test/render/refForwardSpread.brm
  - packages/brumate/src/codegen/markup.ts
shared:
  - .changeset/*.md
  - packages/brumate/test/resume.test.ts
  - packages/brumate/src/runtime/client.ts
reserves: []
provides: []
depends_on: []
---

# A forwarded ref survives a spread on a component

## Goal

A component in a dynamic tag that spreads its props onto its root gets the dynamic tag's anchor through the spread, before its own, so a forwarded `ref` stays empty. The element's own `b-b` must win, on the server and in the browser.

## Context

- The cause, the fixtures and the failing test are in [reviews/core-gaps.md](../../reviews/core-gaps.md), section 1. Use them as they are, and see the test fail before the fix.
- Found by as-collections (#252), whose change request was rejected so the core is fixed instead.

## Acceptance

- [x] The test of reviews/core-gaps.md section 1 fails on main and passes with the fix.
- [x] The packages/brumate suite passes, and the gzip size of the eager core grows by at most 0.1 kB.
- [x] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one rule in the server spread, and a check of the client path.

## Log

- 2026-10-26: owned paths corrected at review: the fix is in the codegen, which the review of #255 found right, and it asked to record it. The owned paths were also split into a list, which a script of the orchestrator had joined into one line.
