---
id: imported-function-prop
title: An imported function can be a prop of a component
status: active
priority: must
type: fix
outline: false
milestone: 0.6.2
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-07
owns: []
shared:
  - packages/brumate/src/**
  - packages/brumate/test/**
  - .changeset/*.md
reserves: []
provides: []
depends_on: []
---

# An imported function can be a prop of a component

## Goal

A function that a `.brm` file imports from a `.ts` module can be passed as a prop, as a function declared in the component can.

## Context

- Found 2026-11-07 by the fresh review of split-ui-examples (#489). `examples/ui` passes `isDateUnavailable=closed` to `Calendar` from `@brumate/ui`. With `closed` declared in the section's script it works. With `closed` moved to `examples/ui/src/closed.ts` and imported, typecheck passes but `pnpm --filter example-ui build` fails: `The value of "ownUnavailable" in Calendar_12jhc6z holds a Function, which cannot be sent to the browser`.
- docs/decisions.md: the server knows a function prop "from the reference of the function prop, so only functions that the compiler marked can go through". An imported function gets no mark.
- #489 works around it by declaring `closed` twice (CalendarSection.brm, RangeCalendarSection.brm), with a comment that names this node. Remove the copy once this lands.

## Acceptance

- [ ] Probe on `main` first: the smallest page that passes an imported function as a prop to a component that keeps it in state fails the same way. If it does not fail, write why in the outcome and close the node.
- [ ] A test passes an imported function as a prop, on the server render, after resume and in a component the browser renders, and the child calls it.
- [ ] A function prop from an import that is live (reads state) follows the rules of decisions.md for function props, or the outcome says why it cannot.
- [ ] Patch changeset for brumate.

## Sizing

S: the compiler marks imported functions as it marks local ones, plus tests.
