# Outcome: spread-children-live

## Built

- Cause: `refresh` (packages/brumate/src/runtime/client/insert.ts) runs every update of the scopes in markup that the core reads after a write: a `#loading` body that streams in, a page that navigation or a second mount adds (`writes > 0` in `readRecord`), an item of a windowed list that comes back. A spread onto a component gives it `*` in `analyzeProjectProps`, so its `children` and `as` get updates. The refresh ran them with the values of the record, which the server had just rendered:
  - `content`/`text` of `children` got the `RenderedChildren` of the record, and `write` replaced the server's nodes with a fresh render of the same children;
  - `retag` of a dynamic tag with a component in `as` kept the server's element only for a string tag, so it rendered the whole block again.
    The guess of the brief (a template body sends the props again) is not the cause: no update of a parent sends `children`.
- Fix, in the runtime:
  - The server records, on the reference of the children, the scope where it first rendered them: `$b.n(ref, scope, at)` (server.ts `Children`, serial.ts `ChildrenPlugin`, shared.ts `ChildrenReference.at`). `RenderedChildren` keeps `at`, and navigation shifts it with `scope` (client-routes.ts `shiftState`).
  - `write` in client/inserts.ts: during a refresh, the first write of an insert whose value is a `RenderedChildren` keeps the nodes when the insert is at the scope where the server rendered them (`value.at === at.id`). Elsewhere, such as `{shown() ? children : 'none'}` where the server rendered `none`, it renders them. The children's own scopes refresh on their own.
  - `retag` in client/branches.ts: the first update keeps the block when the tag is a component and a block scope of that kind holds a child scope of the same module (`m === brumateId`).
- Why the runtime and not the analysis: a spread can carry `children` and `as`, so keeping them out of `*` is not sound. The runtime fix also covers a component whose `children` are live for any other reason.
- Tests in packages/brumate/test/resume.test.ts, `describe('a spread onto a component')`, with fixtures `test/render/spreadChildren{Page,Wrap,Box,List,Target,Pick,Stream}.brm`. spreadChildrenWrap spreads onto spreadChildrenBox. Two tests fail on main and pass now: the children of a box in a `#loading` body that streams in after a change, and the component in `as` of a box there. Three more pass on main and guard other paths: an update of a prop, an update of a template that renders the box, and children that the server did not render at an insert (spreadChildrenPick, from the review; it failed with the first version of the fix).

## Deviations

- Outside the brief's paths, for the review fix: packages/brumate/src/runtime/server.ts, serial.ts, shared.ts and client-routes.ts, a few lines each, so the state names where the server rendered children. A client-only check is not sound: the DOM does not mark which children the server rendered at an insert.
- The project analysis is unchanged, so `analyzeProjectProps` of packages/ui is the same before and after.
- The as-controls `it.fails` test of a ToastRegion with `as=AsTarget` still fails. It is not this cause: AsTarget gets no live props from the part (as-live-props), so its children never update when a toast leaves. It stays `it.fails`.

## Stubs left

- None.

## Gotchas

- A component in `as` that the refresh now keeps gets its new attributes only through `prop`. With as-live-props (#278) its props are live, so they arrive.
- A reference of children that a record sends before the server renders them (such as a layout's children, rendered later in a streamed body) has no `at`, so a refresh renders them again, as before this node. Only the first scope where the server rendered them is kept.
- The bug only shows when a write happened before the markup is read. A test that resumes one page with `vi.resetModules()` never refreshes. The ui tests mount several pages in one loaded core, so the second mount of a file refreshes.

## Proposed learnings

- An update that `refresh` runs must keep what the server rendered when its value is the one the server rendered with (children, a tag) | the refresh runs every update of new server markup, with the record's own values | packages/brumate/src/runtime/client | yes (resume tests that write before a body streams in)

## Verification

- `npx vitest run test/resume.test.ts -t "spread onto a component"` in packages/brumate: 2 fail on main, 5 pass with the fix.
- With the old `AsTreeItem.brm` (`<TreeItem as=AsTarget {...rest}>{children}</TreeItem>`), not committed: tree.test.ts, as-collections.test.ts and as-controls.test.ts pass (36 passed, 2 expected fail). On main, tree.test.ts "opens and closes with the chevron" and as-collections "renders a second page in the same loaded code" failed.
- After the merge of origin/main: `npx vitest run` in packages/brumate: 55 files, 988 passed, 6 expected fail. `npx vitest run --maxWorkers=2` in packages/ui: 57 files, 536 passed, 2 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate, and `node ../tsc/bin/brumate-tsc.js --noEmit` in packages/ui: no errors (a deliberate error fails each). `npx oxlint --quiet`: exit 0. `npx oxfmt --check`: pass.
- Not run: `node e2e/run.mjs`, `pnpm bench`.

## Size

- Chunks of dist (`npx tsdown`), minified with esbuild, gzip -9, main (after #278) then head: client 15681 to 15758 (+77 B), produce 2016 to 2019 (+3 B), so the eager core grows by 80 B, within the budget of 0.1 kB. client-routes, which loads with navigation: 1009 to 1027 (+18 B).
- Estimated M, actual M.
