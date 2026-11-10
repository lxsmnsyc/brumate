# Outcome: dock-layout-fixes

## Built

Fixes in `packages/brumate/src/runtime/devtools-panel/`, checked by reading the CSS against the prototype (no browser here).

1. Class collision. The Values/Graph toggle is now `.views` (was `.seg`). `style.ts` lost the old panel rules that nothing draws any more: `.seg*`, `.ruler`, `.track`, `.run-*`, `.interaction`, `.bar*`, `.navigation`, `.entry`, `.kind-*`, `.kv`, `.cards`, `.error-message`, `.error-row*`, `.tree-row*`, `.written` with `flash`, `.slot*`, `.slots`, `.filters`, `.chip*`, `tr.busy`, `tr.ended`, `tr.failed`. `tr.large` stays (page.ts).
2. Inspect header. The `h3` is the component name only (normal case, ellipsis), the path keeps its link icon, and `.views` sits at the right end of the row, in the flow. The scope label moved to a tag, shown when the selection is not the component itself. The old `h3` rule of `style.ts` (uppercase, dim) is reset in `.ins .title h3`.
3. Inspect tree. One row per block: the scopes of a parent that share `k` (the items of a `#for`) group into one row named `#for`, with `N items` as meta; other blocks show `#id`. Blocks nest by indent under the component, and groups nest in groups. Clicking a row with several scopes again moves to the next scope. A hidden block is a dimmed row (`.off`) in place of the text "hidden". Rows are `flex: none` so the list scrolls and does not squeeze them.
4. Activity. With no call selected the log has the whole width (`.split.activity.solo`, no detail pane, no handle). A selected call opens `ctx.split` with the log first and the detail beside it. The detail pane has no padding of its own and `.act-detail .calld` is `width: auto`, so the call detail's own padding is the only one.
5. Page. Metrics grid (4 columns, 2 in the right dock, 1 px rules by grid gap), then two sections (1.3fr / 1fr, one column in the right dock). Left: Page state with bar and legend (stand-in for "What the browser loaded", as dock-page documented), Blocks as one row each (what, state, action), then the values table. Right: Environment and the buttons. The values table is `table-layout: fixed` with ellipsis and a `title` on each cell, headers shortened (`copies`, `size`, `read by`), inside a horizontally scrolling wrapper. Texts in metrics clip with ellipsis.
6. Right dock. `split.ts` already stacks panes. Page, metrics and sections follow the prototype's `.panel.right` rules (see 5).

## Class renames

- `.seg` (inspect Values/Graph toggle) to `.views`.
- `.edge` on the graph's SVG paths to `.gedge` (it matched `.panel.bottom .edge` and `.panel.right .edge` of the dock's resize edge). `.gedge.hot-edge`, `.lit`, `.faded` keep their suffixes.
- `.stack` in page.ts (the size bar) to `.sizes`.
- `.legend` in style.ts and page.ts, `.sec`, `.btn`, `.acts`, `.list`, `.detail` are scoped per module (`.pg`, `.calld`, `.issues`, `.ins`, `.split.*`), so they do not collide.
- Removed from `activity.ts`: `.panel.right .calld` and `.split.activity > .list { width: 58% }` (call-detail's and split's to style).

## Deviations

- Edited outside the owned paths: `graph.ts` (the rename) and the tests `devtools-dock-graph.test.ts`, `devtools.test.ts` (selectors and the labels of block rows).
- The page-state table stays (the prototype has none) because `devtools.test.ts` and the "large value" hint use it. It is now the last block of the left column.
- Block rows do not show the collection (`#for todos`): the dev server's label has only the block kind and its place.

## Stubs left

- None.

## Gotchas

- In the stacked (right) dock, Activity's `start: 560` is clamped to the box height minus the detail minimum. The prototype gives the log 42%. A percentage start in `split.ts` would match it.
- Nothing was looked at in a browser. Look at the five points above in Chrome.
- Files changed: `devtools-panel/style.ts`, `inspect.ts`, `activity.ts`, `page.ts`, `graph.ts`; tests `devtools-dock-inspect.test.ts`, `devtools-dock-activity.test.ts`, `devtools-dock-page.test.ts`, `devtools-dock-graph.test.ts`, `devtools.test.ts`; this folder (`log.md`, `outcome.md`).

## Proposed learnings

- Each module's injected CSS scopes every class under its own root class, and a class of `style.ts` is used by one part only | one stylesheet serves one shadow root, so a shared name styles both parts | packages/brumate/src/runtime/devtools-panel | yes (a test could list class names per style tag)

## Verification

- `pnpm --filter brumate exec vitest run test/devtools`: 11 files, 109 passed.
- `pnpm --filter brumate typecheck`, `pnpm lint` (warnings only, none in the changed files), `pnpm format:check`: pass.
- `pnpm --filter brumate exec vitest run`: 92 files, 3120 passed, 1 skipped.
- `pnpm --filter brumate build`: pass, dist rebuilt.
- New tests: Values/Graph switch inside `.title`, not absolutely positioned, no `.seg` in any style; one `#for` row with `2 items` nested one step; Activity without a detail pane or handle until a call is selected; page blocks as one row each and values cells with titles.

## Size

- Estimated M, actual M.
