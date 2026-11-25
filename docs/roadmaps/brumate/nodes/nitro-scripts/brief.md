---
id: nitro-scripts
title: The Nitro entry writes no script tag
status: active
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
verify: pnpm --filter example-nitro test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - examples/nitro/**
shared:
  - website/docs/deploying.md
reserves: []
provides: []
depends_on:
  - on: default-scripts
    kind: hard
    why: the entry relies on the default scripts, in dev and in the Nitro build output
---

# The Nitro entry writes no script tag

## Goal

`examples/nitro/src/entry-server.ts` loses the `?assets=client` import and the `import.meta.env.DEV` ternary (lines 11-14) and calls `handle(request, { address })`. Debate claim P4 ([debate](../../../../debates/vite-client-scripts/debate.md)).

## Acceptance

- [ ] `vite dev` in examples/nitro serves a page that loads `/@vite/client` and the start module, and its clicks work.
- [ ] `vite build` then the Node output serves a page that names the hashed client entry; `examples/nitro/test/build.test.ts:39-45` still passes, so the manifest path follows Nitro's client `outDir`.
- [ ] The Nitro snippet in `website/docs/deploying.md` (about line 33) matches the example.

## Sizing

S: one entry file, one doc snippet, one test run in dev and build. If the manifest path is wrong under Nitro, the fix goes in default-scripts' code here, with a note in the outcome.
