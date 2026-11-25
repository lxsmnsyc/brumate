---
id: client-scripts
title: Apps never write the client scripts
status: active
priority: must
type: story
story: 
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/default-scripts test/dev-pages
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

> 2026-11-23: from the approved debate [vite-client-scripts](../../../../debates/vite-client-scripts/debate.md). Decision in `docs/decisions.md` (the entry that starts "An app never writes the `/@vite/client` tag").

# Apps never write the client scripts

## Goal

A brumate app never writes the `/@vite/client` tag or the client entry script, in dev or production, whether it runs plain `vite dev`, Nitro or its own server. Plain `vite dev` serves pages, so the five Node examples lose their `server.ts`, `node.ts` and `server.prod.ts`, and run on Nitro in production. Brumate ships no Node adapter (brumate-node dropped 2026-11-25).

## Children

| Child               | Size | What                                                                                                                                      |
| ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| default-scripts     | M    | `handle` defaults `scripts`: the dev pair under `vite dev`, the built entry tag in production; a missing client manifest is a build error |
| dev-pages           | M    | Plain `vite dev` serves pages through a post middleware; `appType: 'custom'`; skipped under `middlewareMode` and Nitro                    |
| nitro-scripts       | S    | The Nitro entry drops `?assets=client` and the DEV ternary; e2e in dev and build                                                          |
| examples-glue       | M    | Delete the hand-written tags and example glue, repoint the e2e, guard test                                                                |
| script-nonce        | S    | The default script tags carry the nonce of the render; `handle` options typed as `RouteOptions` (found by examples-glue)                  |
| nitro-prerender     | M    | Prerendering works in a Nitro build (found by examples-glue)                                                                              |
| dev-client-entry    | S    | The app's own client entry runs in development (found by client-scripts-docs)                                                             |
| client-scripts-docs | S    | getting-started, deploying, reference-plugin and the skill                                                                                |

default-scripts goes first. dev-pages and nitro-scripts follow it (both edit `vite.ts` or rely on its default). examples-glue waits for the first three, and the docs wait for examples-glue.

## Decisions

The settled structure, budget, rejected alternatives and prior art are in the debate. In short:

- An explicit `scripts`, including `''`, still wins, so CSP nonce setups and custom servers keep control.
- Streaming does not change: the tags go in the tail of the first chunk (`runtime/server.ts`, `firstRender`).
- Rejected: a `clientScripts()` helper that every server calls, and a plugin-owned client entry (`src/client.ts` stays).

## Acceptance

- [ ] `grep -rn '@vite/client' examples website/docs benchmarks website/scripts` finds only `benchmarks/brumate-0.3` (pinned to 0.3.0) and the doc of the `scripts` override; a test enforces it.
- [ ] `pnpm dev` in hackernews, tracker, ui, kit-app and browser-async runs `vite` and serves pages, and their e2e suites pass. todos keeps its own `middlewareMode` server as the own-server case (debate step 5).
- [ ] examples/nitro passes its e2e in dev and build with no script tag in its entry.
- [ ] Root `pnpm test` and the e2e suites pass.

## Budget

6 to 10 days on one worker (one parallel worktree on this machine, debate J1), about 200k tokens.
