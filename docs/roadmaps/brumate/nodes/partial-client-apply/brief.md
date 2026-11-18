---
id: partial-client-apply
title: The loader sends the keep tree and applies a partial answer
status: todo
priority: must
type: feature
story: partial-route-responses
early: false
outline: false
milestone: 0.9.0
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/partial/client.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-18
spent:
owns:
  - packages/brumate/test/partial/client.test.ts
shared:
  - packages/brumate/src/runtime/navigate.ts
  - packages/brumate/src/runtime/loader.ts
  - packages/brumate/src/runtime/testing.ts
reserves: []
provides: []
depends_on:
  - on: partial-render-spike
    kind: contract
    via: partial-route-response
  - on: partial-server-render
    kind: behavior
    via: partial-route-response
---

# The loader sends the keep tree and applies a partial answer

## Goal

`navigate` builds `x-brumate-keep` from the regions of the current page and sends it with link, back and forward navigations. When the answer has `x-brumate-partial: 1`, it swaps the changed regions into the kept layouts without reading kept markup. Otherwise it behaves as today.

## Context

- `planRoutes` (`runtime/navigate.ts:187`) and `replaceRoutes` (`:214`) work on a parsed full document. A partial body has the changed regions at the top level. Pair them by the `layout` scope in the comment against the old regions' `layout` (the client already knows it), not by nesting. `plan` (`:123`) then needs a flat mode.
- `regions(document.body)` (`:83`) already reads the tree to send. Add `keepHeader()` next to `base()` (`:434`).
- The fetch at `:716-720` sets the header; a form (`visit.init`) and `visit.reload` do not send it.
- The head and `<html>` code (`:513`, `:785-795`) is unchanged, because the partial answer carries them whole.
- `style-files` also edits `keepStyles` (`:163`); keep this node's edits to the plan and fetch code.
- Behavior edge: the e2e check needs the server node; build against the contract fixture until it lands.

## Acceptance

- [ ] A unit test with the contract fixture swaps the changed regions, keeps the layout DOM node and its state, runs the new state records and sets `b-drop`, `b-roots`, `b-alias`.
- [ ] A response without `x-brumate-partial` is read as a full page, with no change from today.
- [ ] A partial answer that does not pair with the page (an unknown layout scope) loads the whole page again with the header off, once.
- [ ] The header is absent for forms, reloads and the first load.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/partial/client.test.ts`

## Sizing

L: browser swap logic with a new pairing mode and a retry path; core of the loader, a size cost to report (gzip of the loader and navigate chunk before and after).

## Notes for the worker

- Report the gzip change of `navigate.ts` in `outcome.md`.
- The retry must not loop: one full retry per navigation.
