# Log: dock-graph

- The brief and the story brief are not on the story branch; read from main. Folder created here.
- Layout: placeholders for edges that skip columns go through the same sweep as nodes (`arrangeGraph`), so they get rows and no line crosses a node. `layoutGraph` keeps its signature and returns the node positions only.
- `drawGraph(ctx, scope, info)` is the new form. The entry (`devtools-panel.ts`, not mine) still calls `drawGraph(ctx, id, instance, info)`, so that form stays as a deprecated overload. Drop it when the shell passes a scope.
- Styles go in `graph.ts` as `<style data-graph>`, added once. The old graph rules in `style.ts` (`.graph-wrap`, `.legend`, `.zoom`, `svg .node ...`, `svg path.edge ...`) are now partly dead or overridden; dock-shell should delete them.
- Dead end: none. Skipped the prototype's staggered mark by depth (140 ms each); a write marks all hot nodes at once.
- Doubt: a click redraws the whole view (`ctx.draw()`), so keyboard focus on a node is lost after Enter.

## Review round 1

- Marks: BFS distance from the written node, each node and edge animates with `animation-delay: dist*140 - elapsed` ms (from the write's time, so a redraw does not restart it). A node stays hot until `entry.time + dist*140 + HOT_MS`; the clearing redraw is set for the latest such end.
- Selecting builds the new frame with `drawNodes`, `replaceWith`, and focuses `[data-node]`, so the dock does not draw again and focus stays. Pan and zoom live in `shell.view`.
- `fit` marks the id as fitted only when the box has a width, so a hidden dock fits when it shows.
- `arrangeGraph`: depth by topological order (a cycle ends, its nodes keep the depth of their other inputs), one placeholder for each (source, column), adjacency lists in `follow`. Measured on random forward graphs of long depth, `arrangeGraph` only: 600 nodes / 4193 edges 1215 ms before, 315 ms after; 1000 / 10989 6695 ms before, 1014 ms after. The remaining cost is the sweeps over up to nodes times columns placeholders; real components are far shallower.
- `style.ts`: `.legend` and `.legend i` stay, since `page.ts` uses them. The rest of the old graph rules are gone.

## Review round 2

- The mark ends when the deepest node reached from the written node has been lit for HOT_MS; `follow` runs once per written node per draw.
- Arrowheads use `fill="context-stroke"`, so they take the stroke colour as it animates (one marker instead of three).
- Edges are appended faded first, lit and hot last. Each path has `data-edge` with its index.
- The expiry test records the `setTimeout` delays during the draw instead of using fake timers, which would stall `expect.poll`.
