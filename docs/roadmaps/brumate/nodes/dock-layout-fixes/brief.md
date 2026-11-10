---
id: dock-layout-fixes
title: Dock layout fixes from a browser check
status: done
priority:
type: fix
story: dev-dock-redesign
early: false
outline: false
milestone:
target:
ship: pr
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter brumate exec vitest run test/devtools
exclusive: []
fulfilled_by: "#509"
gate: false
added: 2026-11-10
spent: 175000
owns:
  - packages/brumate/src/runtime/devtools-panel/style.ts
  - packages/brumate/src/runtime/devtools-panel/inspect.ts
  - packages/brumate/src/runtime/devtools-panel/activity.ts
  - packages/brumate/src/runtime/devtools-panel/page.ts
  - packages/brumate/test/devtools*.test.ts
shared:
  - packages/brumate/src/runtime/devtools-panel/*.ts
reserves: []
provides: []
depends_on:
  - on: dock-split-handle
    kind: hard
    why: fixes the landed dock
---

# Dock layout fixes from a browser check

## Goal

The maintainer opened the finished dock in a browser (examples/tracker) and the layout is broken. No child was checked in a real browser; happy-dom has no layout. Fix the defects below so the dock matches `../dev-dock-redesign/prototype/index.html`.

## Defects seen on 2026-11-10 (Chrome, 1200x763, story tip bb87adc1)

1. CSS class collision. `style.ts:179` has `.seg { position: absolute; top: 3px; height: 8px }` for the old timeline segments. Inspect's Values/Graph toggle uses `class="seg"` (`inspect.ts:429`), so it is placed absolutely at the top of the dock, over the workspace nav, where it covers Activity and Issues and takes their clicks. Fix the collision, and audit every class in `style.ts` against the classes the workspace modules use (all styles share one shadow root). Drop old-panel rules nothing uses any more.
2. Inspect detail header: the prototype shows the component name in normal case, the file path with a link icon, and the Values/Graph toggle at the right end of that header row. The build shows "LAYOUT · COMPONENT" in capitals and loses the toggle.
3. Inspect tree: the prototype shows blocks as one row each (`#for todos  2 items`, `#head  #3`), nested with indent under their component. The build shows one `body of #for (95:3)` row per scope with scope ids. Match the prototype's rows.
4. Activity: the prototype shows the log full width and opens the call detail beside it only when a server call is selected. The build always keeps an empty right pane ("Select a server call ...").
5. Page: the page-state table overflows its column (the "read in the browser by" cell wraps into the next rows). Make the Page workspace follow the prototype's layout (metrics, then the loaded bar or its documented stand-in, then Blocks with Run again / Trigger now, and Environment on the right) without overflow at a 300 px dock height.
6. Check the right-docked layout too: the prototype stacks the columns.

## Acceptance

- [ ] Each defect above is fixed, checked against the prototype at the same viewport.
- [ ] A test asserts the Values/Graph toggle is inside the detail header, not positioned absolutely (computed style is enough in happy-dom).
- [ ] No two modules style the same class name for different parts (list the renames in the outcome).
- [ ] Fast check passes: `pnpm --filter brumate exec vitest run test/devtools`.
