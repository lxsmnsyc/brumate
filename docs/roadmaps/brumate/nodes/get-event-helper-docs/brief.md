---
id: get-event-helper-docs
title: Say that a .ts helper gets the event as an argument
status: todo
priority: must
type: docs
story:
early: false
outline: false
milestone: 0.7.1
target: main
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-11
spent:
owns: []
shared:
  - website/docs/server-functions.md
  - website/docs/reference-server.md
reserves: []
provides: []
depends_on: []
---

# Say that a .ts helper gets the event as an argument

## Goal

The docs of `getEvent()` say that the compiler rewrite applies only to `.brm` code, so a `.ts` helper that a component calls during render must take the event as an argument.

## Context

- Found in the color-scheme review (2026-11-11). `getEvent()` returns the module global `current` (packages/brumate/src/runtime/request.ts), which is cleared at the first `await`. `addEventEdits` in codegen/patch.ts rewrites `getEvent` to `$$ctx.getEvent()` only in component code, because the render awaits memos mid-script. A `.ts` helper is never rewritten, so after an ancestor awaited it throws "before their first await".
- website/docs/server-functions.md:318 says "In a component, `getEvent()` returns the event of the page anywhere in its script"; reference-server.md:21 says "elsewhere it throws". Neither says that a helper called from a component script is "elsewhere".
- Same on main and release/0.8. The error text already says to pass the event to helpers.

## Acceptance

- [ ] One sentence with a short example in each page: call `getEvent()` in the component script and pass the event to the helper.
- [ ] `pnpm --filter website check:samples` passes if a sample is added.
