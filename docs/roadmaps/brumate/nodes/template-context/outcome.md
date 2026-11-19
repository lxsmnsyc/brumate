# Outcome: template-context

## Built

- `TemplateCall` (packages/brumate/src/runtime/client/children.ts) is always children of its owner; the `lexical` flag is removed. A `#template` that a child calls reads the contexts of the child in the browser render, as on the server.
- `renderedTemplate` (packages/brumate/src/runtime/client/inserts.ts) tests the range of the insert for `t` as well as `l`, so in-place updates still tell calls at one scope apart.
- `inRange` (same file) finds a template's scope by the anchors of the scopes inside it too, and by their kept nodes, so a template that only renders a component (DateInput's `segment` prop in @brumate/ui) still updates in place.
- `template-context` and its `diverge(...)` leave `test/differential/data.ts`; `tplContextListPage` is a same page.
- New guard fixture `test/render/tplContextInFilePage.brm`: `<TplProvider>{row('inside')}</TplProvider>`.
- New resume test "updates in place a template prop that only renders a component, which a child calls" (fixtures `tplPropCellPage.brm`, `TplPropCellList.brm`, `TplPropCell.brm`).
- Changeset `.changeset/template-context.md` (patch, brumate).

## Proof

- base: fa137b5b, `npx vitest run test/differential-3.test.ts -t tplContextListPage` with the divergence removed: fails, "The context tpl-level-store has no provider above this component".
- branch: the same command passes.
- DateField: `pnpm --filter @brumate/ui exec vitest run test/datefield.test.ts` fails 2 of 10 with the first version, passes 10 of 10 with the rework. The new resume test fails with the first version and passes with the rework.

## Deviations

- No new resume test: the differential test is the browser render of the page, and resume.test.ts already covers the server side.

## Stubs left

- None.

## Gotchas

- 4dc4d6d0 marked calls lexical to keep old behavior only; no in-file case needed it. The in-file call inside a provider's children already matched the server on the base.
- `scope.t === at` alone is not enough to find a template's scope; it needs the range test.
- A template's scope may have no anchor of its own: test the anchors of the scopes it made. Run the ui unit tests for any runtime change of templates or children.

## Proposed learnings

- A scope that a render makes reads contexts through `t` only when the render pushes `{ from, at }` | keeps browser and server equal | packages/brumate/src/runtime/client | yes (differential test)

## Verification

- Rework (2026-11-19): pnpm lint, format:check and typecheck pass. Root `pnpm test` passes in every package: brumate 3311, ui 842 (plus 1 expected fail), language-server, vscode, tsc and the examples. `node e2e/run.mjs --only website,ui`: website 75 passed, ui 61 passed. `TplPropCellList` is skipped in the differential test, like `TplContextList`, because it needs the `cell` prop of its page.
- First version: pnpm test in packages/brumate 3262 of 3263 (one load failure that passes alone); e2e ui PreviewTrigger failed on the base too. Todos bench: client JS in dist 84.9 kB / 29.9 kB, total JS after use 33.2 kB / 13.8 kB.

## Size

- Estimated M, actual S: two small edits; the in-place lookup needed one more condition.

## History

- The first version landed on batch/brumate-main as 1c96dc1f and was reverted (f7c5f578): its range test missed templates that only render a component, which broke 2 DateField tests of @brumate/ui. The rework adds the `inRange` change and its resume test.

Landed on batch/brumate-main as 9625bb2e (rework, after the revert f7c5f578).
