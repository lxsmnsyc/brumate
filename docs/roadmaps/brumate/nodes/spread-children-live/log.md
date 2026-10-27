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

## 2026-10-27, review fix

- Review: the refresh kept any `RenderedChildren` on its first write, also where the server rendered something else, such as `{ctx!.shown() ? children : 'none'}` with a change before the body streams in. Probe added as a test (spreadChildrenPick in spreadChildrenStream, with a context in the module script of spreadChildrenPick). It fails with the first change and passes on main.
- A context that holds a number did not show it: the page does not refresh its own updates, so the context slot of the body keeps the server value on main too. A function in the context, read directly, does.
- The client cannot tell from the DOM which children the server rendered: a content insert has no marker around them, and a text insert's `<!--t-->` marks the insert, not the children. Rendering them again to compare has side effects (`keep`, new scopes).
- Fix: the server records on the reference of the children the scope where it first rendered them, `$b.n(ref, scope, at)`. The client keeps the nodes only when the insert is at that scope. Navigation shifts `at` with `scope`. A reference sent in a record before the server renders it has no `at`, so the client renders it again, as on main.
- Merged origin/main (#278, as-live-props). The live class workaround for spreadChildrenTarget is gone; all tests pass without it.
- Size, minified, gzip -9, against main: client 15681 to 15758 (+77), produce 2016 to 2019 (+3), client-routes 1009 to 1027 (+18, loads with navigation).

## 2026-10-27, review round 2

- Review: `at` named a scope, and every insert of a component's markup has the same scope. Children that move to a second insert of that scope matched and kept the server's text. Probes added as one test with spreadChildrenMove (`{shown ? 'none' : children}` then `{shown ? children : 'x'}`) and spreadChildrenTwice (`{children}` then `{shown ? children : 'none'}`). It fails with the scope check alone.
- Fix: the server compiler passes the anchor of the insert to `insert()` for a value that reads a prop (codegen/markup.ts), `Children` records it next to the scope, and the state sends it as a fourth argument, `$b.n(ref, scope, at, anchor)`. `text()` and `content()` pass their anchor to `write`, which compares both. The anchor is its own field, so `shiftId` moves only the scope.
- Merged origin/main again.
- Size, minified, gzip -9, against main: client 15681 to 15769 (+88), produce 2016 to 2011 (-5).
