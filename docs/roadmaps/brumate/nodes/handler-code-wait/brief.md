---
id: handler-code-wait
title: A handler waits only for the update code it can need
status: done
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "waits only for"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/handlerWait*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/client/handlers.ts
  - packages/brumate/src/runtime/client/updates.ts
  - packages/brumate/src/codegen/**
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: batching
    kind: hard
    why: it adds the wait for update code that this node narrows
---

# A handler waits only for the update code it can need

## Goal

Since batching (#292), every handler waits for the update code of its whole scope chain before it runs, even a handler that writes nothing. A slow or failed chunk of an ancestor scope then delays or fails unrelated handlers. Limit the wait to the scopes whose slots the handler can write, which the compiler knows. Also, when the load of a held write's code rejects, its held effects stay queued until the next pass: send the error to the nearest `#try` and release them.

## Context

- Both points are follow-ups recorded in the batching outcome (nodes/batching/outcome.md); read it, and the contract contracts/update-pass.md.
- Keep the order guarantee: handlers still run in event order (the `lastHandler` chain).

## Acceptance

- [ ] Tests: a handler that writes nothing runs while an ancestor's update code is still loading; a handler that writes a slot of that scope still waits; a rejected code load reaches the nearest `#try` and later effects run.
- [ ] The packages/brumate and packages/ui suites pass. The gzip size of the eager core does not grow by more than 0.05 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: the wait takes the set of written scopes from the compiler.
