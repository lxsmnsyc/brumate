---
id: loading-await-clone
title: "A #loading body with an await clones its template"
status: todo
priority: should
type: refactor
story:
early: false
outline: false
milestone: 0.10.0
target:
ship: auto
land: auto
from:
size: M
risk: medium
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/clone-bodies.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-26
spent:
owns:
  - docs/roadmaps/brumate/nodes/loading-await-clone/**
shared:
  - packages/brumate/src/codegen/**
  - packages/brumate/src/runtime/client/**
  - packages/brumate/src/features.ts
  - packages/brumate/test/clone-bodies.test.ts
  - packages/brumate/test/resume.test.ts
  - packages/brumate/test/render/**
reserves: []
provides: []
depends_on:
  - on: no-client-html
    kind: hard
    why: left this body on the HTML path; read its outcome
---

# A #loading body with an await clones its template

## Goal

From no-client-html (2026-11-26). The `clientHTML` flag still turns on for a `#loading` body that has an `await` (`awaitLoadingOn.brm`): the block's start marker is written before `$$b.wait`, and the marker and the wait callback share one `$$html`, which `cloneLines` cannot split. Emit the loading markers as nodes around the wait range, so the body clones. Then, if no other body needs it, remove `holdPlace`, `placed`, the `<!--f` parse and the `clientHTML` flag; otherwise list what still needs them.

## Context

- Read no-client-html's outcome: what stays behind the flag, and which templates still render from HTML (ambiguous top tags; the compiler's `plan.rawPlaces`).
- Keep pending and fallback state in scope slots (docs/decisions.md, client restructure entry).

## Acceptance

- [ ] `awaitLoadingOn.brm` clones; clone-bodies' HTML list loses it.
- [ ] Resume, render, template and differential tests, the ui unit tests and the ui and browser-async e2e pass.
- [ ] Todos within 0.3 kB (`pnpm bench --only brumate --scenario todos`).
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`.

## Sizing

M: a codegen change for the loading markers and its runtime reader.
