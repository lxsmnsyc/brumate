---
id: dock-call-data
title: Dev server sends call arguments, results and server logs
status: done
priority:
type: feature
story: dev-dock-redesign
early: false
outline: false
milestone:
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/devtools-calls.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent: 194682
owns:
  - packages/brumate/src/runtime/devtools-calls.ts
  - packages/brumate/test/devtools-calls.test.ts
  - docs/roadmaps/brumate/contracts/dock-call-record.md
shared:
  - packages/brumate/src/runtime/devtools.ts
  - packages/brumate/src/vite.ts
  - packages/brumate/src/runtime/rpc.ts
reserves: []
provides: [dock-call-record]
depends_on: []
---

# Dev server sends call arguments, results and server logs

## Goal

Record what a server call needs for its detail, dev only: decoded arguments, the result or the server error with its stack, what ran on the server (memos read, nested calls, `console.*` output) and the timing parts (module, network, server, decode). Freeze the record shape as a contract.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] Arguments and results decode in the browser. Server logs, nested calls and stacks come back from the dev server in a dev-only field of the response; a production build sends none of it (a test builds and checks).
- [ ] Values are cut at a length. No cookies and no headers are recorded.
- [ ] `CallTiming` in `devtools.ts` carries the new record; the contract `dock-call-record` is frozen with its type.
- [ ] A test calls a server function in dev and reads the record: arguments, result, error with stack, a `console.log` and a nested call.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools-calls.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- No panel code here: `dock-call-detail` reads the record. It can build against the contract and a fake record.
- Check the size of the production client: dev-only code must not reach it.
