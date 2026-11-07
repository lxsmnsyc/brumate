---
id: devtools-defer-failed
title: The devtools show a #defer block that got no body as failed
status: done
priority: must
type: fix
outline: false
milestone: 0.6.2
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-07
owns: []
shared:
  - packages/brumate/src/runtime/devtools.ts
  - packages/brumate/test/devtools.test.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# The devtools show a #defer block that got no body as failed

## Goal

The Blocks tab shows a `#defer` block whose request ends without a body as failed, not as loading forever.

## Context

- Found 2026-11-07 by a scan for implicit state machines (repo-setup step 5). `BlockEntry.state` in `packages/brumate/src/runtime/devtools.ts` was set in four places, each with its own guard. `'failed'` was in the type, but nothing set it.
- When the request of a `#defer` ends without a body (404, network error, build skew), the scan wants `'waiting'`, and the guard that keeps a loading block from going back to waiting blocks it. The block stays `'loading'`.

## Acceptance

- [x] The test of the Blocks tab fires a `#defer` that gets a 404 and sees `'failed'`. It fails on `main`.
- [x] Every change of a block's state goes through one transition function.
- [x] A model test checks every sequence of events per kind against a table of the allowed transitions.
- [x] Patch changeset for brumate.

## Sizing

S: one module and its test.

## Outcome

Merged in #490 (914604a5). Block states go through `nextBlockState`; a `#defer` whose request ends without a body shows as failed. Model test checks every event sequence up to 5 per kind.
