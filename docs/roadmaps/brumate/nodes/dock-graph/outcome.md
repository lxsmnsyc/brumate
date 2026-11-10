# Outcome: dock-graph

## Built

The Graph view in `packages/brumate/src/runtime/devtools-panel/graph.ts`, matching `prototype/index.html`.

- `arrangeGraph(nodes, edges, getWidth)` returns `{ position, routes }`. A node's column is its depth (longest path from a source). An edge that skips columns gets a placeholder in each column it crosses, sorted with the nodes by neighbour average over 8 sweeps. Columns are centred on the tallest one. `layoutGraph` keeps its export and signature and returns `position`.
- `drawGraph(ctx, scope, info)` takes any scope of the component and returns the view (an empty state without a graph). `drawGraphTab` is unchanged in behavior.
- Nodes show the name and the value (coloured by type), a dot coloured by kind, and a tooltip that names the kind and the line. Arrowheads in three colours. No legend, no column headings, no chain folding.
- A write marks its node and every node after it in yellow for `HOT_MS`.
- A click dims everything outside the lineage (upstream and downstream at any depth) and lights only edges on a path through the node. A side opens with the kind, the place in the file (`place`, from `graph-node-locations`), the value, and Reads and Read by as links to those nodes. Empty sections are hidden. The cross, the empty graph and Enter or Space also work.
- A write lights its node, then each node after it 140 ms later, with an `animation-delay` that counts from the write, so a redraw does not restart it.
- Pan by drag, zoom at the pointer by wheel, zoom buttons and a fit button (the fit leaves room for the side).
- Tests: `packages/brumate/test/devtools-dock-graph.test.ts` (layout, size, cycle, empty-graph and view tests).

## Deviations

- Two files outside the owned paths, edited with the maintainer's leave in the review: `devtools-panel.ts` (`ctx.drawGraph` is now `(scope, info) => drawGraph(ctx, scope, info)`, so the old id-and-instance overload is gone) and `devtools-panel/style.ts` (the old graph rules are deleted; `.legend` and `.legend i` stay because `page.ts` uses them). This node goes to the maintainer as a PR, not a direct commit.
- A node is as wide as its widest label (120 to 262), not the prototype's fixed 148, so long names do not clip.
- `pickNodeColor` (was `nodeColor`) now returns a CSS colour (peach for signals and props, as the prototype) instead of a pill colour name. Nothing else used it.

## Stubs left

- None.

## Gotchas

- Old graph rules in `style.ts` are dead or overridden by the `<style data-graph>` in `graph.ts`. dock-shell should delete them (`.graph-wrap`, `.legend`, `.zoom`, `svg .node`, `svg path.edge`, `.graph-side`).
- Selecting a node replaces only the graph, so focus stays. Any `state.changed` redraw of the dock still rebuilds the body and drops focus; dock-shell should keep focus across those.
- `arrangeGraph` runs on every redraw; its cost is bounded by nodes times columns placeholders (see log.md for timings).
- The view needs the dev server's `graph`; older servers get the "restart it" message.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/devtools-dock-graph.test.ts test/devtools.test.ts`: 20 passed. `test/devtools*`: 5 files, 46 passed.
- `pnpm --filter brumate typecheck`: pass. `npx oxlint`: no errors or warnings in these files. Root `npx oxfmt --check`: pass.

## Size

- Estimated M, actual M.
