---
id: dev-dock-redesign
title: Redesign of the dev dock
status: todo
priority: should
type: feature
outline: true
milestone: 0.7.0
target:
from:
size: L
spike: false
verify: 
exclusive: []
fulfilled_by: 
gate: true
added: 2026-11-03
owns:
  - packages/brumate/src/runtime/devtools-panel.ts
shared:
  - .changeset/*.md
  - website/docs/inspect.md
reserves: []
provides: []
depends_on: []
---

# Redesign of the dev dock

## Goal

A new design for the devtools dock of the dev server: the grip at the bottom edge of the page, the tab it grows into, and the panel with its tabs (Overview, Errors, Components, Elements, Graph, Log, Blocks, Report).

## Context

- Asked by the maintainer on 2026-11-03.
- The dock lives in `packages/brumate/src/runtime/devtools-panel.ts` (about 3,100 lines) and is described in `website/docs/inspect.md`.
- Gate: a prototype goes to the maintainer first. After approval, the port matches the prototype exactly and drops parts of the old panel that are not in it.
- A first prototype (2026-11-03, in git history before v2) has: a floating island when closed (version, issue count, activity graph, Pick); 4 workspaces in place of 13 tabs (Inspect = Components + Elements + Graph; Activity = Log + Timeline + Effects + Navigation + Server; Issues; Page = Overview + Page state + Blocks); ⌘K search; a floating dock at the bottom or on the right.
- Prototype v2 (2026-11-05, `prototype/index.html`, not approved yet) follows the maintainer's review of the first: no floating bar (closed is the grip on the bottom edge again, as in 80d1d590), no coloured left edges for a selected row (filled row with a soft ring, as in 0dca8035), the brumate version in the header while open, and the dock attached to the bottom or right edge.
- Server function calls are in scope (the maintainer, 2026-11-03): a call in Activity opens a detail with its decoded arguments, its result or server error with stack, timing (module, network, server, decode), what ran on the server (memos read, nested calls, `console.*` output), what the result changed, and Run again (with a warning about side effects), Copy as fetch, Copy for an agent. Today the panel records only name, status and times (`CallTiming` in `devtools.ts`); arguments and results can be decoded in the browser, but server logs and stacks need the dev server to send them back, dev only. Values are cut at a length; no cookies or headers.
- devtools-copy adds buttons to the same panel, so it waits for this node.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it: first write down what the redesign changes (layout, tabs, look) with the maintainer, then split the prototype from the port.
