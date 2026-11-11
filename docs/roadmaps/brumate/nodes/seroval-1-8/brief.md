---
id: seroval-1-8
title: Upgrade seroval to 1.8.0, with its split entry points, validators and @seroval/transport
status: done
priority: must
type: refactor
outline: false
milestone: 0.8.0
target:
from:
size: M
spike: false
verify:
exclusive: [bench]
fulfilled_by: 437a424b (batch/brumate-release-0.8)
gate: false
added: 2026-11-09
spent: 340000
owns:
  - packages/brumate/src/runtime/serial.ts
  - packages/brumate/src/runtime/stream.ts
  - packages/brumate/src/runtime/idempotent.ts
  - packages/brumate/src/runtime/cache.ts
shared:
  - packages/brumate/package.json
  - pnpm-lock.yaml
  - packages/brumate/src/runtime/rpc.ts
  - packages/brumate/src/runtime/request.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# Upgrade seroval to 1.8.0, with its split entry points, validators and @seroval/transport

## Goal

brumate uses seroval 1.8.0. Each module imports from the entry point that matches its side (`seroval/read`, `seroval/write`, `seroval/shared`) instead of the root, values decoded from the network go through `seroval/validator`, and the byte-stream transport of server function calls and streamed pages uses `@seroval/transport` instead of brumate's own framing.

## Context

- Asked by the maintainer on 2026-11-09.
- Today: `packages/brumate/package.json` has `seroval` and `seroval-plugins` at `^1.7.0`. Imports, all from the root `seroval` except one from `seroval-plugins/web`: serial.ts (`Feature`, `createPlugin`), rpc.ts (`toJSONAsync`), stream.ts (`Stream`, `fromCrossJSON`, `toCrossJSONStream`), idempotent.ts and cache.ts (`fromJSON`, `toJSON`), request.ts (`toJSON`), server.ts (`crossSerialize`, `crossSerializeStream`, `fromJSON`).
- seroval 1.8.0 (npm, `latest` on 2026-11-09) exports `.`, `./read`, `./write`, `./shared`, `./validator`, each with a `development` build. `@seroval/transport` 0.1.0 ("Send seroval streams over fetch and other byte streams") exports `.`, `./web`, `./node`, `./read`, `./frame`, `./write`. Both live in https://github.com/lxsmnsyc/seroval; read the 1.8.0 release notes and the source of both packages there before choosing what maps to what. Copy their API; do not wrap it.
- Upgrade `seroval-plugins` to the version that matches 1.8.0.
- The point of the split entry points is that the client imports only the read side. Size comes first (GOAL.md): report the todos gzip JS before `load` with `pnpm bench --only brumate --scenario todos` against `release/0.8`. It should shrink or stay within 0.3 kB.
- Breaking changes are fine, with no deprecation periods. A change to what brumate accepts on the wire (validation rejects a value that 1.7 took) is a minor changeset.
- Files shared with open work: rpc.ts and request.ts are touched by dock-call-data (#498, on `feat/dev-dock-redesign`); keep edits there to imports and the transport call sites.

## Acceptance

- [ ] `seroval` 1.8.0, the matching `seroval-plugins` and `@seroval/transport` are dependencies of brumate, and the lockfile is updated.
- [ ] No module imports the root `seroval`; each uses `seroval/read`, `seroval/write` or `seroval/shared`, and no client module pulls in the write side (check the built client).
- [ ] Data decoded from a request or a response (server function arguments and results, page state, idempotent keys, the cache) goes through `seroval/validator`, and a test shows a malformed payload is rejected with a clear error.
- [ ] Server function calls and streamed pages use `@seroval/transport` for framing, and brumate's own framing code is removed. The resume, rpc, stream and server-function tests pass unchanged.
- [ ] `pnpm build && pnpm test && node e2e/run.mjs` pass.
- [ ] Todos gzip JS before `load` is reported against `release/0.8`.
- [ ] Changeset for brumate (minor if the wire rules change, otherwise patch).

## Sizing

M: an import migration across 7 runtime files, validator calls on the decode paths, and replacing the stream framing with the transport package.
