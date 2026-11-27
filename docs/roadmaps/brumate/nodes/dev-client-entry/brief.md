---
id: dev-client-entry
title: The app's own client entry runs in development
status: done
priority: 
type: fix
story: client-scripts
early: false
outline: false
milestone: 
target:
ship: auto
land: auto
from:
size: S
risk: medium
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/default-scripts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent: 291326
owns:
  - docs/roadmaps/brumate/nodes/dev-client-entry/**
shared:
  - packages/brumate/src/routes.ts
  - packages/brumate/src/vite.ts
  - packages/brumate/test/default-scripts/**
  - website/scripts/dev.ts
  - website/docs/**
  - e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: client-scripts-docs
    kind: hard
    why: found by its self-review; the docs describe today's behaviour and change with the fix
---

# The app's own client entry runs in development

## Goal

Found by client-scripts-docs (2026-11-26), from reading `devScripts` in `packages/brumate/src/routes.ts` and `defaultScripts` in `vite.ts`. In dev, the default tags load the generated start module (`virtual:brumate/start`), not the app's client entry. An app whose `src/client.ts` does more than `start()` loses that in dev: `website/src/client.ts` (the live-sample `load`) and `examples/trace/src/client.ts` (`onTrace`). In production the default tag is the built client entry, so dev and production differ. `website/scripts/dev.ts` lost its own `scripts` in examples-glue, so the website dev server is affected now.

## Context

- Prove it first: open the website dev server or `examples/trace` under `vite dev` and show that the client entry's own code does not run (a test, or e2e).
- Fix: in dev, load the configured client entry (the client environment's input, the same one the production manifest names) when the app has one, and the start module only when it has none. Keep one source of truth for "the client entry" for dev and build.
- Update the docs that client-scripts-docs wrote about the dev tags.

## Acceptance

- [ ] A test or e2e step shows a client entry's own code runs in dev; it fails before the fix.
- [ ] The website dev server's live samples and trace's `onTrace` work in dev.
- [ ] A patch changeset; the docs match.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

S: the dev default names the client entry.
