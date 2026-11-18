---
id: route-render-split
title: Route rendering leaves server.ts
status: active
priority: must
type: refactor
story: partial-route-responses
early: true
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter brumate test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - packages/brumate/src/runtime/route-render.ts
shared:
  - packages/brumate/src/runtime/server.ts
reserves: []
provides: []
depends_on: []
---

# Route rendering leaves server.ts

## Goal

Move the code that renders a route tree into `runtime/route-render.ts`, with no change in behavior. `server.ts` (4845 lines) is edited by this story, style-files and others at once. After the move, the partial work edits the new file.

## Context

- Moves: `viewIds`, `viewComponent` and `renderView` (`runtime/server.ts:4088-4132`), `renderPage` (`:4235`) and `renderRoute` (`:4725`), with the types only they use. `server.ts` imports them and re-exports what other modules import today.
- Source: decomposition guide, "Split hot files by feature first".

## Acceptance

- [ ] The diff only moves code and fixes imports. No test is edited.
- [ ] `pnpm --filter brumate test` and `pnpm e2e` pass, and the built `dist` of the website is byte-equal to the one on main apart from chunk names.
- [ ] Fast check passes: `pnpm --filter brumate test`

## Sizing

S: one move, no change. Lands on `release/0.9` before the story branch is used (`early`).

## Notes for the worker

- Keep `export` names. `testing.ts` and `vite.ts` import from `server.ts`; do not touch them.
- If a helper is used by both `server.ts` and the moved code, export it from `server.ts` instead of copying it.
