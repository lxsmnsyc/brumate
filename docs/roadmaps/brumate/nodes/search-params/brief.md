---
id: search-params
title: State in the URL with $searchParam
status: todo
priority: should
type: feature
outline: false
milestone: features
target:
from:
size: M
spike: false
verify: pnpm --filter brumate exec vitest run test/search-params.test.ts
exclusive: []
fulfilled_by: 
gate: false
added: 
owns:
  - packages/brumate/src/runtime/search-params.ts
  - packages/brumate/test/search-params.test.ts
  - website/docs/navigation.md
shared:
  - packages/brumate/src/runtime/signals.ts
  - packages/brumate/src/analyze.ts
  - packages/brumate/src/macros.ts
  - packages/brumate/src/features.ts
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/client.ts
reserves: []
provides: []
depends_on:
  - on: batching
    kind: contract
    via: update-pass
---

# State in the URL with $searchParam

## Goal

`$searchParam(name, options)` gives a signal bound to one parameter of the query string. The server reads it from the request URL, and a write in the browser updates the URL with `replaceState`, or `pushState` with an option, without a request.

## Context

- `$route().search` reads the query string but cannot write it. Its handling is in runtime/server.ts and client.ts, which `$searchParam` mirrors. Two writes in one handler make one change of the URL, through the end of a pass (update-pass contract).
- Source: [State in the URL](../../../../proposals.md#state-in-the-url)

## Acceptance

- [ ] The server renders the value of the URL.
- [ ] A write changes the URL and asks the server nothing.
- [ ] Back and forward write the signal.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: known pattern (nuqs, shallow routing), new to the repo.
