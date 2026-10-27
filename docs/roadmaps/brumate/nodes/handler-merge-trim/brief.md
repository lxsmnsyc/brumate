---
id: handler-merge-trim
title: Measure and trim the merged handlers of #264
status: todo
priority: should
type: refactor
outline: false
milestone: smaller-client
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "merge"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/shared.ts
  - packages/brumate/src/runtime/serial.ts
  - packages/brumate/src/runtime/client.ts
  - packages/brumate/src/runtime/server.ts
reserves: []
provides: []
depends_on:
  - on: component-tag-live-props
    kind: hard
    why: trims the code that #264 added
---

# Measure and trim the merged handlers of #264

## Goal

#264 merges handlers of one event into one function, and went over its size budget: 174 B in `client-*.js` and 578 B in `produce-*.js`, measured as gzip of the unminified build. Measure the minified gzip cost of that code, then make it smaller without changing behavior.

## Context

- `mergeHandlers` and `addEntryHandlers` are in shared.ts, so the browser ships the entry parsing that only the server needed before. Client `dynamicNodes` now uses it too.
- A merged handler in the page state has its own plugin in serial.ts (`brumate/merged`) and state value `m`. A marked array of function references may do the same with less code.

## Acceptance

- [ ] The minified gzip cost of the merge code on main is recorded in the outcome, before and after.
- [ ] The eager core is smaller after than before, and the merge tests of #264 still pass.
- [ ] The packages/brumate suite passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: a few helpers in four runtime files.
