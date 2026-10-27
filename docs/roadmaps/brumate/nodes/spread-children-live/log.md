# Log: spread-children-live

## 2026-10-27

- Reproduced in packages/ui: the old `AsTreeItem.brm` (`<TreeItem as=AsTarget {...rest}>{children}</TreeItem>`) fails "opens and closes with the chevron" in tree.test.ts, and the test passes alone.
- `analyzeProjectProps` gives TreeItem `*` from AsTreeItem, so TreeItem compiles `u90`, `content($$s, 1, get($$s.p, children))`, and a `retag` block for `as`. Without the spread, TreeItem has no update for its children.
- The page template of trees.brm sends only `class` and `textValue` again. No update of a parent sends `children`. The guess of the brief (a template body sends the props again) is not the cause.
- A trace in `content` shows the cause: `refresh` (insert.ts) runs every update of the scopes of a state record that the core reads after a write (`writes > 0` in `readRecord`). In tree.test.ts, an earlier test of the file wrote, so the mount of the next page refreshes. The refresh runs `u90` with the `RenderedChildren` of the record, and `write` replaces the nodes the server rendered with a fresh render of the same children. The chevron and the focus go.
- The same path runs for a `#loading` body that streams in after a change, for a page that navigation adds, and for an item of a windowed list that comes back.
- Reduced to packages/brumate: `spreadChildrenStream.brm`, a `#loading` body with `<SpreadChildrenBox class=(tone)><input /></SpreadChildrenBox>`, where spreadChildrenWrap spreads onto the box. A click before the body streams in, then the input is replaced. The test fails on main. Two more tests (an update of a prop, an update of a template) pass on main; they guard the paths the brief named.
- Fix choice: the runtime. During a refresh, the first write of an insert whose value is a `RenderedChildren` keeps the nodes, because the server rendered those same children there, and their own scopes refresh on their own. The analysis fix (keep `children` out of `*`) is not sound: a spread can carry `children`.
- With the children fix, tree.test.ts passes with the old fixture, but as-collections "renders a second page in the same loaded code" still failed. Second facet: `*` makes `as` live, so TreeItem wraps its dynamic tag in `retag`. On the refresh, `retag` keeps the server element only for a string tag, and rendered the block of a component tag (AsTarget) again. Added a failing test (a box with `as=SpreadChildrenTarget` in the streamed body), then the fix: the first update keeps the block when a block scope holds a child of the same module.
- spreadChildrenTarget gets no live props from the box (as-live-props), so the test page renders it once with a live class, so its rest is live and the class arrives.
- The ToastRegion `it.fails` of as-controls still fails: AsTarget's children are static (as-live-props), not this cause.
- Size: client chunk minified, gzip -9, 15679 to 15738 (+59 B).
