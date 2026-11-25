---
id: kept-page-nonce
title: A kept page gets the request's nonce
status: active
priority: should
type: hotfix
story:
early: false
outline: false
milestone: 0.9.1
target: main
ship: auto
land: auto
from:
size: S
risk: medium
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/page-cache
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent:
owns:
  - docs/roadmaps/brumate/nodes/kept-page-nonce/**
shared:
  - packages/brumate/src/runtime/server.ts
  - packages/brumate/src/runtime/route-render.ts
  - packages/brumate/test/page-cache*
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# A kept page gets the request's nonce

## Goal

Found by script-nonce (2026-11-26) and confirmed on `main` by its review. A page kept by `cache` stores the nonce of its first render on its inline scripts and its state script. A later request with a new nonce gets the old nonce in the body and the new one in its policy, so no script runs. Serve a kept page with the request's nonce on every `nonce` attribute (or none when the request has none), and render fresh instead of keeping a page whose nonce appears anywhere else (a meta policy, script text, JSON, a stored header).

## Context

- The fix was built on the client-scripts story (fix/script-nonce 91e4711) and is ported here, so it ships in 0.9.1 from `main`. A rewrite must use a replacement function: a nonce with `$&` or `$'` expanded and duplicated the document.
- `pageKey` doesn't include the nonce, so the cache still hits for nonce and no-nonce requests.

## Acceptance

- [ ] A page-cache test fails on `main` and passes with the fix: a kept page served to a second nonce has no old nonce left.
- [ ] Tests for a `$` nonce, and for a nonce outside an attribute (not kept).
- [ ] A patch changeset.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

S: the cache rewrite and its tests.
