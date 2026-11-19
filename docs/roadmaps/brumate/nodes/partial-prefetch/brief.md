---
id: partial-prefetch
title: Prefetch fetches partial answers
status: todo
priority: later
type: feature
story: partial-route-responses
early: false
outline: false
milestone: backlog
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/partial/prefetch.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - packages/brumate/test/partial/prefetch.test.ts
shared:
  - packages/brumate/src/runtime/navigate.ts
reserves: []
provides: []
depends_on:
  - on: partial-client-apply
    kind: hard
    why: it edits the same prefetch map and fetch code in navigate.ts that client-apply changes
  - on: partial-server-render
    kind: behavior
    via: partial-route-response
---

> 2026-11-18: parked by the maintainer after the navigation debate (../../../../debates/navigation/debate.md). It restarts only when an app with a server asks for partial navigation, or a throttled run of benchmarks/navigation shows a wait a person would notice.

# Prefetch fetches partial answers

## Goal

After the answer to question 2 in `questions.md` (recommended: A), a hover or focus prefetch sends the keep header, and a click reuses the answer when the keep tree and `x-brumate-base` are the same.

## Context

- `prefetch` (`runtime/navigate.ts:581`) stores `{ at, base, response, controller }`; `takePrefetched` (`:620`) compares the base. Add the keep value to the entry and compare it.
- A mismatch (the page changed after the hover) fetches again as `navigate` does, and aborts the old one (`clearPrefetched`, `:604`).
- If the maintainer picks B, this node drops the keep header from `prefetch` and only adds the test that a full prefetched page still swaps through `planRoutes`.

## Acceptance

- [ ] A hover then click within 10 s makes one request, with `x-brumate-keep`, and swaps in part.
- [ ] A hover, then a change of the kept tree (a navigation elsewhere), then a click makes a new request.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/partial/prefetch.test.ts`

## Sizing

M: one function pair and its tests.

## Notes for the worker

- Prefetch must never send a request that the server would store as a partial answer in a shared cache; see the cache answer.
