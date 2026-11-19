---
id: partial-fallbacks
title: Every case that must stay a full page, in e2e
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
verify: pnpm e2e partial
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - e2e/suites/partial.mjs
shared:
  - e2e/run.mjs
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/runtime/partial.ts
reserves: []
provides: []
depends_on:
  - on: partial-server-render
    kind: behavior
    via: partial-route-response
  - on: partial-client-apply
    kind: behavior
    via: partial-route-response
---

> 2026-11-18: parked by the maintainer after the navigation debate (../../../../debates/navigation/debate.md). It restarts only when an app with a server asks for partial navigation, or a throttled run of benchmarks/navigation shows a wait a person would notice.

# Every case that must stay a full page, in e2e

## Goal

An e2e suite that runs the real server and a browser through each case where a partial answer is wrong or impossible, and fixes the gaps that it finds in `partial.ts` or `navigate.ts`. A gap on a common path is a bug to fix here, not a limit to note.

## Context

- Cases: form post and its redirect; `visit.reload` after a server function; a build mismatch during a deploy (`navigate.ts:~795`, `loadOnce`); back and forward; a redirect in a route; a 404; a route that throws and shows `_error`; a prerendered static file that ignores the headers (`b-root` check, `navigate.ts:195`); a prerendered shell with holes (`server.ts:4482`); a `#loading` view and a `#defer` block in the new route; a layout that renders `<title>` or `#head`; `data-rerun` head scripts; a link to the same page with a new query; CSP nonce.
- The server-side decisions are in `runtime/partial.ts`; browser fallbacks in `navigate.ts`. Both are shared with other nodes of the story, so keep edits small and in the failing path.
- Add the suite to the runner in `e2e/run.mjs` (see `e2e/README.md`).

## Acceptance

- [ ] One test per case above, each asserting what loaded (`x-brumate-partial` present or absent) and what the page shows.
- [ ] Layout state (an input value and focus in the kept layout) survives a partial swap, and is reset on a full one.
- [ ] Fast check passes: `pnpm e2e partial`

## Sizing

L: spans server and browser paths and every error case; may fix defects in two other nodes' code.

## Notes for the worker

- Do not call a failing case a limit. Fix it, or send it to the orchestrator as a blocker with the failing test.
- Run only this suite plus the website suite, not the full e2e matrix, until the end.
