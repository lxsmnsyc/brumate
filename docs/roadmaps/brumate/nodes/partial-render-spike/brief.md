---
id: partial-render-spike
title: Spike: render only the changed routes
status: todo
priority: later
type: experiment
story: partial-route-responses
early: false
outline: false
milestone: backlog
target:
ship: auto
land: auto
from:
size: M
spike: true
hypothesis: docs/debates/navigation/debate.md
verify: pnpm --filter brumate exec vitest run test/partial/spike.test.ts
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-18
spent:
owns:
  - packages/brumate/test/partial/spike.test.ts
  - packages/brumate/test/partial/fixtures/**
  - docs/roadmaps/brumate/nodes/partial-render-spike/**
shared: []
reserves: []
provides:
  - partial-route-response
depends_on:
  - on: navigation-debate
    kind: hard
    why: the debate decides whether this story goes on and fixes the gate threshold
---

> 2026-11-18: parked by the maintainer after the navigation debate (../../../../debates/navigation/debate.md). It restarts only when an app with a server asks for partial navigation, or a throttled run of benchmarks/navigation shows a wait a person would notice.

# Spike: render only the changed routes

## Goal

Answer, with a throwaway server test, whether the server can run the kept layouts silently and still write the changed routes with the layout scope IDs of the client's page. Then freeze `contracts/partial-route-response.md` (the orchestrator sets `frozen` from the outcome).

## Context

- Question 1: can a kept layout run with its markup and state records dropped, and its contexts still reach a new route, with no scope ID of the new routes colliding with the client's (`x-brumate-base`)? Look at `viewComponent` (`packages/brumate/src/runtime/server.ts:4120`) and the scope allocator `ctx.peek()` used for `root`.
- Question 2: does the `layout` field of a region comment (`R<layout>:...`) equal the client's layout scope when the server is told that scope, so `plan` (`runtime/navigate.ts:123`) needs no alias for kept layouts?
- Question 3: what happens to `#loading` views and `$route()` params in the kept layouts?
- Time box: one session. Write the three answers, the final header and body format, and the fixture in `packages/brumate/test/partial/fixtures/`.

## Gates (fixed by navigation-debate before the run)

- Go needs: for the pairs that partial-measure measures, the partial response is at least 40% smaller in gzip than the full page (or the threshold the debate fixes), and the three questions above have a working answer.
- Anything else is a no-go: the story stops after this node, and the full-page swap stays. The orchestrator drops the remaining children and amends the 0.9.0 cut.
- Swap time is checked by the story's acceptance once partial-client-apply exists; this spike estimates it from the bytes and the parse of the partial body.

## Acceptance

- [ ] `test/partial/spike.test.ts` renders a two-layout tree for one link, once in full and once in part, and checks: context from a kept layout reaches the new route, the part has no markup of the kept layout, and IDs do not overlap.
- [ ] `outcome.md` answers the three questions with a go or no-go, and lists changes to the contract.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/partial/spike.test.ts`

## Sizing

M: new design on the server render path; uncertainty medium, one test file.

## Notes for the worker

- On no-go for silent layouts, the fallback is to render the full tree and cut the kept regions from the stream; write that variant down with its cost.
- Do not edit `server.ts`; prototype in the test with a copy of `viewComponent`.
