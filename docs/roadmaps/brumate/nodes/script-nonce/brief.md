---
id: script-nonce
title: The default script tags carry the nonce of the render
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
risk: low
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/default-scripts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent: 365137
owns:
  - docs/roadmaps/brumate/nodes/script-nonce/**
shared:
  - packages/brumate/src/routes.ts
  - packages/brumate/src/vite.ts
  - packages/brumate/types.d.ts
  - packages/brumate/test/default-scripts/**
  - e2e/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: examples-glue
    kind: hard
    why: the four Nitro e2e suites it moved lost their nonce check; this node puts it back
---

# The default script tags carry the nonce of the render

## Goal

Found by examples-glue (2026-11-26). The default scripts that `handle` writes, `/@vite/client` with the start module in dev and the entry tag in production, have no `nonce`. So a page with a strict Content Security Policy (`script-src 'nonce-…' 'strict-dynamic'`) cannot load its client unless the app writes the tags itself, which the story is meant to end. The render already takes a nonce for its `<style>` elements (`root.nonce` in `runtime/server.ts`). Give the default tags the same nonce.

## Context

- The tracker, kit, ui and browser-async e2e suites moved to Nitro in examples-glue and dropped their nonce policy check, keeping only Trusted Types through a proxy in `serveNitro` (`e2e/lib.mjs`). Put the nonce check back in all four.
- `packages/brumate/types.d.ts` types the `handle` options of `virtual:brumate/routes` as `DocumentOptions`, but the runtime takes `RouteOptions` (which has `earlyHints`). The entries pass options as a variable, so no excess-property error fires. Type them as `RouteOptions`.
- An explicit `scripts` still wins, with or without a nonce.

## Acceptance

- [ ] With a nonce in the options, every default script tag has `nonce="…"`, in dev and in a build; without one, none has it. Tests in `test/default-scripts`.
- [ ] The four e2e suites check the nonce policy again and pass.
- [ ] `handle` options in `types.d.ts` are `RouteOptions`; root typecheck passes.
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

S: one attribute on the default tags, a type, and four e2e checks.
