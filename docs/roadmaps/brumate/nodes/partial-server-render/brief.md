---
id: partial-server-render
title: The server answers a keep header with only the changed routes
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
size: L
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/partial
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - packages/brumate/src/runtime/partial.ts
  - packages/brumate/test/partial/server.test.ts
  - packages/brumate/test/partial/contract.test.ts
shared:
  - packages/brumate/src/runtime/route-render.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/testing.ts
  - docs/decisions.md
reserves: []
provides: []
depends_on:
  - on: route-render-split
    kind: hard
    why: it edits renderPage and viewComponent, which that node moves; editing server.ts first would conflict
  - on: partial-render-spike
    kind: contract
    via: partial-route-response
---

> 2026-11-18: parked by the maintainer after the navigation debate (../../../../debates/navigation/debate.md). It restarts only when an app with a server asks for partial navigation, or a throttled run of benchmarks/navigation shows a wait a person would notice.

# The server answers a keep header with only the changed routes

## Goal

`renderPage` reads `x-brumate-keep`. For a GET page request whose keep tree matches the next route, it runs the kept layouts silently, renders the changed routes with the head, `<html>` attributes and state records of the whole page, and answers with `x-brumate-partial: 1`. Any other request gets the full page.

## Context

- Contract: `contracts/partial-route-response.md`. Read the spike outcome.
- Edit points after the split: `renderPage` (read the header, choose the plan), `viewComponent` (a `silent` mode for kept slots, region comments with the client's layout scope), the response headers (`vary: x-brumate-keep`; `cache-control: private` for a partial answer, if the maintainer picks B in questions.md), and `pageKey` (a partial answer is not stored under B).
- The server answers in full for every case in the contract's Behavior. Keep the decision in one function in `partial.ts`: `planPartial(request, tree, build) -> Plan | undefined`.
- `fillHoles` (prerendered shell, `server.ts:4482`) already skips requests with `x-brumate-base`; the keep header changes nothing there.
- Prior art: Next.js renders from the first differing segment of `next-router-state-tree`; React Router skips the loaders of kept routes with `_routes`. Here the layouts still run for their contexts.

## Acceptance

- [ ] A request with a matching keep header gets `x-brumate-partial: 1` and a body without the kept layouts' markup; the new routes' IDs start at `x-brumate-base`.
- [ ] Without the header, with a malformed header, a wrong build, a different root route, an equal tree, or a non-GET request, the answer is the full page, byte-equal to today's.
- [ ] A context from a kept layout reaches the new route; a `#loading` view of a new route streams after `</html>`.
- [ ] The head, `b-html` and `<title>` of the new page are in the partial answer.
- [ ] A partial answer is not stored by the page cache (option B) or is stored with the keep header in the key (option A), as the maintainer decides. Tests for the chosen one.
- [ ] `docs/decisions.md` records the header, the silent layouts and the cache rule.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/partial`

## Sizing

L: server render path, state records, streaming, cache and many full-page fallbacks. Coupling is medium (client-apply reads the same contract). Context load over 20k (server.ts parts).

## Notes for the worker

- Never serve a partial response to a request without `x-brumate-keep`, even from a cache.
- A kept layout that throws has no error route to show a partial in; answer in full.
- Do not touch `runtime/navigate.ts`; partial-client-apply owns the browser side.
