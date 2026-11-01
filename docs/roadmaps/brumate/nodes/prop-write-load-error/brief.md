---
id: prop-write-load-error
title: A prop write to a child whose code fails to load reaches the nearest #catch
status: done
priority: should
type: fix
outline: false
milestone: 0.4.1
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
  - packages/brumate/src/runtime/client/props.ts
reserves: []
provides: []
depends_on: []
---

# A prop write to a child whose code fails to load reaches the nearest #catch

## Goal

In packages/brumate/src/runtime/client/props.ts, a prop write to a child component runs `void loadModule(child.m).then(apply)` with no `catch`. When the child's module fails to load, the rejection is unhandled and no `#try` catches it. Route it to `fail(child, error)`, as other failed module loads do.

## Context

- Found 2026-11-01 by the prune-lazy-parts worker and confirmed on main by reading the code in its review (PR #407); not yet reproduced. That PR added the same one-line fix; it moves here, since a bug on main gets its own fix from main.
- `fail` in client/errors.ts walks up to the nearest `#try` and calls `options.onError`.

## Acceptance

- [ ] A test that fails on main: a parent writes a prop to a child whose module load rejects, inside a `#try`; the `#catch` renders and no unhandled rejection is reported.
- [ ] The fix passes that test; brumate tests pass.
- [ ] Patch changeset.

## Sizing

S.
