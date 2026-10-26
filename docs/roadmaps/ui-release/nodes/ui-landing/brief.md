---
id: ui-landing
title: A landing page for @brumate/ui
status: todo
priority: must
type: docs
target:
from:
size: M
spike: false
verify: pnpm --filter website check:samples
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - website/ui/index.md
  - website/src/routes/ui/index.brm
  - website/ui/demos/Landing*.brm
shared:
  - website/src/routes/ui/_layout.brm
reserves: []
provides: []
depends_on: []
---

# A landing page for @brumate/ui

## Goal

Give /ui a landing page that shows what the parts are: unstyled, accessible, resumable, with a few live parts and the numbers of what a closed or unused part ships.

## Context

- The /ui section has its own navigation and search. The start pages are styling, state, resuming, layers and influences.
- Source: [A landing page for @brumate/ui](../../../../proposals.md#a-landing-page-for-brumateui)

## Acceptance

- [ ] /ui shows the landing page, with live samples that compile: `pnpm --filter website check:samples`.
- [ ] The website builds.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: one page with a few demos.
