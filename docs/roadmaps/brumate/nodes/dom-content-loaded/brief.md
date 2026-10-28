---
id: dom-content-loaded
title: A DOMContentLoaded handler listens to the right event
status: todo
priority: could
type: fix
outline: false
milestone: 0.6.0
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-28
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/elements.d.ts
  - packages/brumate/src/event-names.ts
  - packages/brumate/src/parser.ts
  - packages/brumate/src/runtime/**
  - packages/brumate/test/**
reserves: []
provides: []
depends_on:
  - on: camel-event-names
    kind: hard
    why: it made the event list and the camel-case rule this node extends
---

# A DOMContentLoaded handler listens to the right event

## Goal

`<document onDOMContentLoaded>` (or the name the node settles on) runs its handler on `DOMContentLoaded`. Today the compiler lower-cases a handler name, so it listens to `domcontentloaded`, which the browser never fires.

## Context

- Found in the review of camel-event-names (#317). It is broken on main before #317 too. `DOMContentLoaded` sits in the one-word list of the completeness test in packages/brumate/test/elements-types.ts.
- Decide first whether a handler for it makes sense at all: page code loads at start, after the HTML, so the event may have fired before any handler is attached. If it never can run, make the attribute a compile error with a catalog entry instead, and remove it from the types.
- Check the other DOM events whose names are not all lower case.

## Acceptance

- [ ] A test shows the handler runs, or the attribute is a compile error with the reason in its catalog entry.
- [ ] The completeness test in elements-types.ts still passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

S: one event name, a test, and maybe one catalog entry.
