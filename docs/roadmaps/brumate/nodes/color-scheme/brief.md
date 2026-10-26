---
id: color-scheme
title: A color scheme part without a first-paint flash
status: todo
priority: could
type: feature
outline: false
milestone: ui-0.1
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/color-scheme.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/ui/src/ColorScheme.brm
  - packages/ui/src/color-scheme.ts
  - packages/ui/test/color-scheme.test.ts
  - website/ui/color-scheme.md
  - website/ui/demos/ColorSchemeDemo.brm
shared:
  - website/src/ui.ts
  - examples/ui/src/**
  - e2e/suites/ui/**
reserves: []
provides: []
depends_on:
  - on: split-ui-examples
    kind: hard
    why: it adds an example and an e2e step
  - on: docs-generator
    kind: hard
    why: its page follows the props-table format
---

# A color scheme part without a first-paint flash

## Goal

A `ColorScheme` part keeps the choice of light, dark or system in a cookie, so the server renders the right class and the page has no flash.

## Context

- Request locals shipped in 0.2.0, so a component can read a cookie on the server.
- Source: [A color scheme without the first-paint flash](../../../../proposals.md#5-a-color-scheme-without-the-first-paint-flash)

## Acceptance

- [ ] The server renders the class of the cookie.
- [ ] A change writes the cookie and the class.
- [ ] `pnpm --filter @brumate/ui exec vitest run` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: a part and a cookie helper, new to the parts.
