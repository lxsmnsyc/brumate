---
id: examples-glue
title: The examples drop their hand-written servers and tags
status: todo
priority: 
type: chore
story: client-scripts
early: false
outline: false
milestone: 
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - examples/todos/**
  - examples/hackernews/**
  - examples/tracker/**
  - examples/ui/**
  - examples/kit-app/**
  - examples/browser-async/**
  - benchmarks/brumate/src/server.ts
  - website/scripts/dev.ts
  - e2e/**
shared:
  - packages/brumate/test/no-hand-scripts.test.ts
  - website/package.json
reserves: []
provides: []
depends_on:
  - on: default-scripts
    kind: hard
    why: the servers drop scripts only once the default exists
  - on: dev-pages
    kind: hard
    why: the dev scripts become vite only once vite dev serves pages
  - on: nitro-scripts
    kind: hard
    why: the guard test covers examples/nitro
---

# The examples drop their hand-written servers and tags

## Goal

Debate claims P5, P8, O3 ([debate](../../../../debates/vite-client-scripts/debate.md)).

- In hackernews, tracker, ui, kit-app and browser-async: delete `server.ts`, `node.ts` and `server.prod.ts`; the `dev` script becomes `vite`. Production runs on Nitro, as `examples/nitro` does: `nitro()` after `brumate()` in the Vite config, a `src/entry-server.ts` like `examples/nitro/src/entry-server.ts` after nitro-scripts (server function calls, then `handle(request, { address: request.ip })`), and `vite build` with `node .output/server/index.mjs` to start. Nitro serves the static files; keep the early hints if Nitro's route rules or the entry can send them, and say in the outcome if one cannot.
- todos keeps a `middlewareMode` `server.ts` as the documented own-server case, without `scripts`. It deletes `node.ts` and uses `toNodeHandler` from `srvx/node` (add `srvx` to its dependencies, pinned to the version Nitro uses).
- `benchmarks/brumate/src/server.ts` and `website/scripts/dev.ts` drop their hand-written tags. `benchmarks/brumate-0.3` is pinned to brumate 0.3.0 and stays as it is.
- Repoint e2e suites and tests that spawn `server.ts` to `vite`.
- A test fails when `@vite/client` appears in `examples`, `website/docs`, `benchmarks` or `website/scripts`, except `benchmarks/brumate-0.3` and the docs paragraph about the `scripts` override.

## Acceptance

- [ ] The acceptance of the story about the grep and `pnpm dev` holds.
- [ ] Root `pnpm test` and the e2e suites pass (see the memory note: run all tests, not package-only).
- [ ] The todos bench click checks pass: `pnpm bench --only brumate --scenario todos`.

## Sizing

L: five apps move to Nitro and their e2e suites run Nitro builds, on top of the deletions across seven folders (debate O10).

> 2026-11-25: brumate-node dropped by the maintainer (no adapters of brumate's own, `docs/decisions.md`). The examples move to Nitro for production, and todos uses `srvx/node`.
