---
id: imported-function-prop
title: An imported function can be a prop of a component
status: done
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

- [x] Probe on `main` first: the smallest page that passes an imported function as a prop to a component that keeps it in state fails the same way. If it does not fail, write why in the outcome and close the node.
- [x] A test passes an imported function as a prop, on the server render, after resume and in a component the browser renders, and the child calls it.
- [x] A function prop from an import that is live (reads state) follows the rules of decisions.md for function props, or the outcome says why it cannot.
- [x] Patch changeset for brumate.

## Sizing

S: the compiler marks imported functions as it marks local ones, plus tests.

## Outcome

Merged in #492 (bdae61b5). `mayExportFunction` reads the module of an import that a prop passes: an exported function, or an export of a module the compiler cannot read, is marked as a local function is, and the server binds a copy per use. Values, components, `.brm.ts` modules and server functions pass as before. An imported function cannot read component state; a store it reads counts as a derivation, as decisions.md says. The `closed` copies on `next` (#489) are removed after the sync.
