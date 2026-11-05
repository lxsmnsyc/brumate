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
  - packages/brumate/src/runtime/devtools.ts
  - website/docs/inspect.md
reserves: []
provides: []
depends_on:
  - on: graph-node-locations
    kind: hard
    why: each graph node links to its place in the file
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
- The reactivity graph stays (the maintainer, 2026-11-05). The first prototype shrank the Graph tab to a one-line "what reads" chain inside Inspect, with no recorded reason; that is undone. Inspect's detail pane has a Values | Graph switch. Graph keeps everything the Graph tab has today (website/docs/inspect.md): every signal, prop, memo, markup read and effect of the selected component as a layered DAG (2026-11-05 review: a node's column is its depth, the longest path from a source, not its kind, so memos of memos sit further right; edges that skip a column route through it; columns are sorted to cross less and centred), arrowheads for the flow, the current value on each node, no legend or column headings (the dot colour gives the kind, its tooltip names it), a write marking its node and every node after it in yellow, a click dimming everything outside the node's lineage and opening what it reads, what reads it and its place in the file (empty sections hidden), and pan and zoom with a fit button.
- Resizable panels (the maintainer, 2026-11-05): each split inside the dock has a handle to drag, as the dock edge does: the component tree and its detail, the activity log and a call's detail, the issue list and its code. The handle shows on hover, works with the keyboard (focusable, arrow keys move it), and has a minimum size for each side. Sizes are kept per split, with the dock's height and side, for the next open.
- Update outlines (the maintainer, 2026-11-05): draw the boxes on one `<canvas>` overlay, as solid-start's devtools do, in place of a `<div>` per box. Today `installFlash` in `packages/brumate/src/runtime/devtools.ts` appends a `div.flash` to the shadow root for each changed element (up to `MAX_FLASHES` a frame) and removes it with a `setTimeout` after `FLASH_MS`. The canvas covers the viewport with `pointer-events: none`, keeps a list of boxes with their rect, heat colour and start time, and redraws them in one `requestAnimationFrame` loop that fades them out and stops when the list is empty. It sizes itself to `devicePixelRatio` and redraws on resize and scroll. The MutationObserver and the heat counts stay.
- devtools-copy adds buttons to the same panel, so it waits for this node.

Outline: not broken into a brief yet. Refine it when `plan.py refine` lists it: first write down what the redesign changes (layout, tabs, look) with the maintainer, then split the prototype from the port.
