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
size: M
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
  - on: brumate-node
    kind: hard
    why: the production servers import brumate/node in place of node.ts
---

# The examples drop their hand-written servers and tags

## Goal

Debate claims P5, P8, O3 ([debate](../../../../debates/vite-client-scripts/debate.md)).

- In hackernews, tracker, ui, kit-app and browser-async: delete `server.ts` and `node.ts`; the `dev` script becomes `vite`. `server.prod.ts` imports `toRequest`/`send` from `brumate/node`, drops the manifest read and `scripts`, and keeps the static files and early hints.
- todos keeps a `middlewareMode` `server.ts` as the documented own-server case, without `scripts`, importing `brumate/node`.
- `benchmarks/brumate/src/server.ts` and `website/scripts/dev.ts` drop their hand-written tags. `benchmarks/brumate-0.3` is pinned to brumate 0.3.0 and stays as it is.
- Repoint e2e suites and tests that spawn `server.ts` to `vite`.
- A test fails when `@vite/client` appears in `examples`, `website/docs`, `benchmarks` or `website/scripts`, except `benchmarks/brumate-0.3` and the docs paragraph about the `scripts` override.

## Acceptance

- [ ] The acceptance of the story about the grep and `pnpm dev` holds.
- [ ] Root `pnpm test` and the e2e suites pass (see the memory note: run all tests, not package-only).
- [ ] The todos bench click checks pass: `pnpm bench --only brumate --scenario todos`.

## Sizing

M: mostly deletions across seven folders; the e2e repointing is the main cost (debate O10).
