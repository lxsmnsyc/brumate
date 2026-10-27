# Outcome: spread-children-live

## Built

- Cause: `refresh` (packages/brumate/src/runtime/client/insert.ts) runs every update of the scopes in markup that the core reads after a write: a `#loading` body that streams in, a page that navigation or a second mount adds (`writes > 0` in `readRecord`), an item of a windowed list that comes back. A spread onto a component gives it `*` in `analyzeProjectProps`, so its `children` and `as` get updates. The refresh ran them with the values of the record, which the server had just rendered:
  - `content`/`text` of `children` got the `RenderedChildren` of the record, and `write` replaced the server's nodes with a fresh render of the same children;
  - `retag` of a dynamic tag with a component in `as` kept the server's element only for a string tag, so it rendered the whole block again.
    The guess of the brief (a template body sends the props again) is not the cause: no update of a parent sends `children`.
- Fix, in the runtime:
  - `write` in client/inserts.ts: during a refresh, the first write of an insert whose value is a `RenderedChildren` keeps the nodes. The children's own scopes refresh on their own.
  - `retag` in client/branches.ts: the first update keeps the block when the tag is a component and a block scope of that kind holds a child scope of the same module (`m === brumateId`).
- Why the runtime and not the analysis: a spread can carry `children` and `as`, so keeping them out of `*` is not sound. The runtime fix also covers a component whose `children` are live for any other reason.
- Tests in packages/brumate/test/resume.test.ts, `describe('a spread onto a component')`, with fixtures `test/render/spreadChildren{Page,Wrap,Box,List,Target,Stream}.brm`. spreadChildrenWrap spreads onto spreadChildrenBox. Two tests fail on main and pass now: the children of a box in a `#loading` body that streams in after a change, and the component in `as` of a box there. Two more (an update of a prop, an update of a template that renders the box) pass on main and guard those paths.

## Deviations

- None in paths. The project analysis is unchanged, so `analyzeProjectProps` of packages/ui is the same before and after.
- The as-controls `it.fails` test of a ToastRegion with `as=AsTarget` still fails. It is not this cause: AsTarget gets no live props from the part (as-live-props), so its children never update when a toast leaves. It stays `it.fails`.

## Stubs left

- None.

## Gotchas

- A component in `as` that the refresh now keeps gets its new attributes only through `prop`, so only when its props are live. Before, the refresh rendered it again, which also hid as-live-props. spreadChildrenPage renders spreadChildrenTarget with a live class so the test sees the class arrive.
- The bug only shows when a write happened before the markup is read. A test that resumes one page with `vi.resetModules()` never refreshes. The ui tests mount several pages in one loaded core, so the second mount of a file refreshes.

## Proposed learnings

- An update that `refresh` runs must keep what the server rendered when its value is the one the server rendered with (children, a tag) | the refresh runs every update of new server markup, with the record's own values | packages/brumate/src/runtime/client | yes (resume tests that write before a body streams in)

## Verification

- `npx vitest run test/resume.test.ts -t "spread onto a component"` in packages/brumate: 2 fail on main, 4 pass with the fix.
- With the old `AsTreeItem.brm` (`<TreeItem as=AsTarget {...rest}>{children}</TreeItem>`), not committed: tree.test.ts, as-collections.test.ts and as-controls.test.ts pass (31 passed, 7 expected fail). On main, tree.test.ts "opens and closes with the chevron" and as-collections "renders a second page in the same loaded code" failed.
- `npx vitest run` in packages/brumate: 55 files, 976 passed, 5 expected fail. `npx vitest run --maxWorkers=2` in packages/ui: 56 files, 529 passed, 7 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: no errors (a deliberate error fails it). `npx oxlint --quiet`: exit 0. `npx oxfmt --check`: pass.
- Not run: the ui typecheck (`brumate-tsc`), `node e2e/run.mjs`, `pnpm bench`.

## Size

- Client chunk of dist (`npx tsdown`), minified with esbuild, gzip -9: 15679 to 15738 (+59 B), within the budget of 0.1 kB. Unminified: 31717 to 31812 (+95, with comments). produce: 4591 to 4591. client-routes: 1841 to 1841.
- Estimated M, actual M.
