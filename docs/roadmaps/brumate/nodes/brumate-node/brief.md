---
id: brumate-node
title: brumate/node exports toRequest and send
status: dropped
priority: 
type: feature
story: client-scripts
early: false
outline: false
milestone: 
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/node
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - packages/brumate/src/runtime/node.ts
  - packages/brumate/test/node/**
shared:
  - packages/brumate/package.json
  - packages/brumate/tsdown.config.ts
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# brumate/node exports toRequest and send

> 2026-11-25: dropped by the maintainer. `docs/decisions.md` says hosts are Nitro's and brumate has no adapters of its own, and `brumate/node` would be one. Production servers use Nitro, and an app's own Node server uses `toNodeHandler` from `srvx/node` (Nitro's server layer), as idlip leaves production to Nitro. This reverses the debate's P8 ruling.

## Goal

`import { toRequest, send } from 'brumate/node'` replaces the `node.ts` that six examples copy (33 lines each, identical; debate J2, P8). `toRequest(incoming)` builds a web `Request` from a Node `IncomingMessage` (method, URL, headers, body). `send(response, serverResponse)` writes a web `Response` to a Node `ServerResponse`, streaming the body. Start from `examples/todos/node.ts`.

## Acceptance

- [ ] `packages/brumate/package.json` has the `./node` export and the build emits it.
- [ ] Tests: a POST body round-trips; a streamed body arrives in chunks; headers with several values (set-cookie) survive.
- [ ] A minor changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

S: one file of about 40 lines, one export, one test.
