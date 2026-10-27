---
id: style-vars-target
title: A live style variable of a part updates on a component in as
status: active
priority: must
type: fix
outline: false
milestone: core-correct
target:
from:
size: S
spike: false
verify: pnpm --filter brumate exec vitest run test/resume.test.ts -t "style variable"
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - packages/brumate/test/render/gapStyleVar*.brm
shared:
  - .changeset/*.md
  - packages/brumate/src/codegen/markup.ts
  - packages/brumate/src/runtime/client/**
  - packages/brumate/test/resume.test.ts
reserves: []
provides: []
depends_on:
  - on: as-live-props
    kind: hard
    why: the live props of a component target come from as-live-props
  - on: split-client-runtime
    kind: hard
    why: the fix may be in the client runtime, which the split moves
---

# A live style variable of a part updates on a component in as

## Goal

A part with a scoped style that reads a live value, such as `<style> [role='row'] { --size: ${size}px } </style>`, renders `<{as ?? 'div'}>`. With an element target the variable updates (12px to 13px). With a component in `as` it stays at the server's value.

## Context

- Found while probing for the review of #278 (`size++` stayed `12px`). Not run on main yet: first see it fail on main, then reduce it to a packages/brumate test.
- The style variables reach the element through the `style` attribute and the scoped-style `Internal`, which #278 sends through the page state for a component target.

## Acceptance

- [ ] A packages/brumate test fails on main and passes with the fix, for a component target. The element target keeps passing.
- [ ] The packages/brumate and packages/ui suites pass. The gzip size of the eager core grows by at most 0.1 kB.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one path of the style variables.
