---
id: dev-dock-redesign
title: Redesign of the dev dock
status: active
priority: must
type: story
story:
early: false
outline: false
milestone: 0.8.0
target:
ship: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: graph-node-locations
    kind: hard
    why: each graph node links to its place in the file
---

# Redesign of the dev dock

## Goal

The devtools dock of the dev server matches the approved prototype (`prototype/index.html`): the grip at the bottom edge, the tab it grows into, and a panel with four workspaces (Inspect, Activity, Issues, Page) in place of the 13 tabs. Server calls have a detail view, the splits resize, and update outlines draw on one canvas. The feature reaches users in one piece, as one story pull request.

## Context

- Asked by the maintainer on 2026-11-03.
- The dock lives in `packages/brumate/src/runtime/devtools-panel.ts` (about 3,100 lines) and is described in `website/docs/inspect.md`.
- Gate: a prototype goes to the maintainer first (done: v2 approved 2026-11-05). After approval, the port matches the prototype exactly and drops parts of the old panel that are not in it.
- A first prototype (2026-11-03, in git history before v2) has: a floating island when closed (version, issue count, activity graph, Pick); 4 workspaces in place of 13 tabs (Inspect = Components + Elements + Graph; Activity = Log + Timeline + Effects + Navigation + Server; Issues; Page = Overview + Page state + Blocks); ⌘K search; a floating dock at the bottom or on the right.
- Prototype v2 (2026-11-05, `prototype/index.html`) was approved by the maintainer on 2026-11-05, with the changes in the bullets below (resizable panels, the layered graph). The port matches it exactly and drops parts of the old panel that are not in it; the prototype's notes box and fake page are not part of the design. It follows the maintainer's review of the first: no floating bar (closed is the grip on the bottom edge again, as in 80d1d590), no coloured left edges for a selected row (filled row with a soft ring, as in 0dca8035), the brumate version in the header while open, and the dock attached to the bottom or right edge.
- Server function calls are in scope (the maintainer, 2026-11-03): a call in Activity opens a detail with its decoded arguments, its result or server error with stack, timing (module, network, server, decode), what ran on the server (memos read, nested calls, `console.*` output), what the result changed, and Run again (with a warning about side effects), Copy as fetch, Copy for an agent. Today the panel records only name, status and times (`CallTiming` in `devtools.ts`); arguments and results can be decoded in the browser, but server logs and stacks need the dev server to send them back, dev only. Values are cut at a length; no cookies or headers.
- The reactivity graph stays (the maintainer, 2026-11-05). The first prototype shrank the Graph tab to a one-line "what reads" chain inside Inspect, with no recorded reason; that is undone. Inspect's detail pane has a Values | Graph switch. Graph keeps everything the Graph tab has today (website/docs/inspect.md): every signal, prop, memo, markup read and effect of the selected component as a layered DAG (2026-11-05 review: a node's column is its depth, the longest path from a source, not its kind, so memos of memos sit further right; edges that skip a column route through it; columns are sorted to cross less and centred), arrowheads for the flow, the current value on each node, no legend or column headings (the dot colour gives the kind, its tooltip names it), a write marking its node and every node after it in yellow, a click dimming everything outside the node's lineage and opening what it reads, what reads it and its place in the file (empty sections hidden), and pan and zoom with a fit button.
- Resizable panels (the maintainer, 2026-11-05): each split inside the dock has a handle to drag, as the dock edge does: the component tree and its detail, the activity log and a call's detail, the issue list and its code. The handle shows on hover, works with the keyboard (focusable, arrow keys move it), and has a minimum size for each side. Sizes are kept per split, with the dock's height and side, for the next open.
- Update outlines (the maintainer, 2026-11-05): draw the boxes on one `<canvas>` overlay, as solid-start's devtools do, in place of a `<div>` per box. Today `installFlash` in `packages/brumate/src/runtime/devtools.ts` appends a `div.flash` to the shadow root for each changed element (up to `MAX_FLASHES` a frame) and removes it with a `setTimeout` after `FLASH_MS`. The canvas covers the viewport with `pointer-events: none`, keeps a list of boxes with their rect, heat colour and start time, and redraws them in one `requestAnimationFrame` loop that fades them out and stops when the list is empty. It sizes itself to `devicePixelRatio` and redraws on resize and scroll. The MutationObserver and the heat counts stay.
- devtools-copy adds buttons to the same panel, so it waits for this node.

## Children

On the branch `feat/dev-dock-redesign`, cut from `release/0.8`:

1. dock-split (M): moves `devtools-panel.ts` into one module per workspace with no change in behavior, and freezes `contracts/dock-workspace-api.md`. Everything in the panel waits for it.
2. dock-shell (M): grip, tab, header with the version, dock to the bottom or the right, workspace nav, search, Pick.
3. dock-split-handle (S): the resizable handle with keyboard and kept sizes.
4. dock-inspect (M) and dock-graph (M): the component tree and detail; the layered graph.
5. dock-activity (M), dock-call-data (M) and dock-call-detail (M): the log and call list; the dev-only call record from the dev server; the call detail.
6. dock-issues (M) and dock-page (M).
7. dock-canvas-outlines (M): independent of the panel.
8. dock-docs (S): `website/docs/inspect.md` and the changeset, last.

`devtools-copy` waits for the whole story.

## Acceptance

- [ ] The built dock matches `prototype/index.html` in layout and behavior: closed it is the grip on the bottom edge, open it shows the brumate version in the header, and it sits at the bottom or the right edge.
- [ ] Four workspaces replace the old tabs. Parts of the old panel that are not in the prototype are gone.
- [ ] A selected row is a filled rounded row with a soft ring, with no coloured left edge. There is no floating bar. The graph is never folded into a chain.
- [ ] Every split in the dock has a handle that works with the pointer and the keyboard, has minimum sizes, and keeps its size with the dock's height and side.
- [ ] A server call opens a detail with arguments, result or error with stack, timing, what ran on the server, and the three actions. A production build sends none of the dev-only data.
- [ ] Update outlines draw on one canvas, and no `div.flash` is added.
- [ ] `website/docs/inspect.md` describes the new dock, and a changeset exists.
- [ ] `pnpm --filter brumate exec vitest run`, `pnpm --filter brumate typecheck`, oxlint and `oxfmt --check` pass on the story branch.
