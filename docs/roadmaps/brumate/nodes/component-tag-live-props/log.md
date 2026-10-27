# Log: component-tag-live-props

- The repro of the brief passes on main for a component that spreads its rest props: the tag's `b-b` goes through the rest to the element, so `attr` finds it. It fails when the component names the prop (`Tag.brm`, `label`): the update finds no element, and the component's entry has no slot for `label`, because the project analysis does not know which component a dynamic tag names.
- Two causes, two fixes. The update has no link to the child scope: the dynamic tag passes no anchor to `component`. And `liveProps` of the component stays empty.
- Link: `dynamicNodes` and the server's `dynamic` read the anchor from `b-b` and pass it to `component`. `attr` calls `prop` when the anchor holds a child scope.
- Live props: `summarize` in project.ts gives the live props of a dynamic tag to each `.brm` import that the file reads as a value, the same set that `valueComponents()` registers.
- `dynamic` in client.ts repeated the function branch of `dynamicNodes`. It calls `dynamicNodes` now, with `holdPlace`.
- Size: client chunk 30854 B on main, 30892 B with the fix, +38 B.
- Review change: the `onCLICK` key is gone. Handlers of one event merge into one function with a `PARTS` list (`mergeHandlers`, `addEntryHandlers` in `shared.ts`). `spreadEntries` and the server `spread` write one entry for each part. The page state keeps a merged handler as `$b.m([...])`. The client's `dynamicNodes` now turns `b-on` of a component tag into handler props, as the server does: it failed in a block for a rest prop's handlers. Tests fail on the old code for the server, nested and `props.onClick` cases; the block case with three own handlers already passed. Size: client +126 B over the PR, produce +578 B, over the budget.
