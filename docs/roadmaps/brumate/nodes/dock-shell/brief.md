---
id: dock-shell
title: Dock shell: grip, tab, header and workspace nav
status: done
priority:
type: feature
story: dev-dock-redesign
early: false
outline: false
milestone:
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/devtools-dock-shell.test.ts test/devtools.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-09
spent: 290000
owns:
  - packages/brumate/src/runtime/devtools-panel/shell.ts
  - packages/brumate/src/runtime/devtools-panel/style.ts
  - packages/brumate/src/runtime/devtools-panel/search.ts
  - packages/brumate/src/runtime/devtools-panel.ts
  - packages/brumate/test/devtools-dock-shell.test.ts
shared:
  - packages/brumate/src/runtime/devtools.ts
reserves: []
provides: []
depends_on:
  - on: dock-split
    kind: hard
    why: the shell edits the entry file and the chrome code that the split moves
---

# Dock shell: grip, tab, header and workspace nav

## Goal

Replace the panel chrome with the prototype's: the grip on the bottom edge when closed, the tab it grows into, the header with the brumate version, search (Cmd+K) and Pick, the dock attached to the bottom or the right edge, and a nav of four workspaces (Inspect, Activity, Issues, Page) in place of the 13 tabs.

## Context

- Story: [dev-dock-redesign](../dev-dock-redesign/brief.md) holds the maintainer's decisions. The approved prototype is `../dev-dock-redesign/prototype/index.html`.
- Rules that hold in every child (the maintainer's decisions in the story brief): no floating bar, no coloured left edge on a selected row (a filled rounded row with a soft ring), the brumate version visible while open, the graph never folded into a chain. The port matches `../dev-dock-redesign/prototype/index.html` exactly and drops old-panel parts that are not in it. The prototype's notes box and fake page are not part of the design.

## Acceptance

- [ ] Closed, the page shows only the grip on the bottom edge. No floating bar, as in 80d1d590.
- [ ] Open, the header shows the brumate version, the workspace nav with issue counts, search and Pick. The dock sits at the bottom or the right edge; the side, the height and the width are kept for the next open.
- [ ] Alt+Shift+D, Escape and the grip open and close the dock; focus returns to the grip on close.
- [ ] Cmd+K opens a search over components, issues and actions, as the prototype does.
- [ ] The nav switches workspaces and keeps the last one. Each workspace shows what its module draws; until the workspace children land, that is the old tab content as the split left it.
- [ ] A test opens the dock, switches the four workspaces, moves the side and checks the version text.
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools.test.ts`

## Sizing

M: see the owned files above.

## Notes for the worker

- Where the prototype and `inspect.md` differ, the prototype wins. The `Pick` button keeps the behavior of `onPick`, `onHover` and `stopPicking` in the old panel.
- Do not draw workspace content here. Workspace children replace the placeholder content in their own modules, so this node never edits them.
