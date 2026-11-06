# Log: graph-node-locations

- Nothing existed for signals, props and memos; markup had the place only in the label text.
- vite.ts: `placeOf` turns an offset into line and column. A module's offset is read against the module's source from disk, with `file` set.
- Panel: `GraphNode.at`; box meta and tooltip show it; side panel `place()` link opens `file:line:column`. The label no longer carries the place, so the old regex split is gone.
- Tests: vite.test.ts adds `vite-app/uses-counter.brm` (a copy of the render fixture) for the module case; devtools.test.ts clicks nodes and checks the editor request.
