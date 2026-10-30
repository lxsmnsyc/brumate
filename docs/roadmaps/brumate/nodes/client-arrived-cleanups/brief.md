---
id: client-arrived-cleanups
title: $client cleanups run when a page that arrived by client navigation is left
status: active
priority: should
type: fix
outline: false
milestone: 0.4.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-30
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/**
  - packages/brumate/test/**
  - e2e/suites/website.mjs
reserves: []
provides: []
depends_on: []
---

# $client cleanups run when a page that arrived by client navigation is left

## Goal

Found by the overlay-navigation-cleanup worker (PR #355) on 2026-10-30: the cleanup of a `$client` callback never runs when the user leaves a page that itself arrived by a client link. An instrumented build showed ModalOverlay's `leavePage` cleanup is not called on the next client navigation. The same page loaded in full runs it.

Repro on the website: follow a client link from /ui/switch to /ui/modal, open the modal, then `page.goBack()`. One overlay layer stays in the page. Loading /ui/modal in full and doing the same leaves nothing.

Likely in the client router's page swap (packages/brumate/src/runtime/client-routes.ts, navigate.ts) or in how scopes of a client-rendered page register their cleanups (client/scopes.ts). Not investigated yet.

## Context

- A main bug: branch from main, its own PR. Start with a failing test (a page reached by client navigation registers a `$client` cleanup; leaving it by a second client navigation runs the cleanup).
- Effects of a client-arrived page may have the same gap; check them too.
- When fixed, replace the dispatched-click e2e step of overlay-navigation-cleanup (`/ui/modal: a client navigation away from an open modal leaves no layer`) with the real path above, using `page.goBack()`.

## Acceptance

- [ ] A test fails on main and passes: `$client` (and `$effect`) cleanups of a page that arrived by client navigation run when the next client navigation leaves it.
- [ ] The website e2e step uses the real path (client link in, open the modal, Back) and passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one missing cleanup call in the router or scope registration, a test and an e2e step.
