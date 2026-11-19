# Outcome: template-context

## Built

- `TemplateCall` (packages/brumate/src/runtime/client/children.ts) is always children of its owner; the `lexical` flag is removed. A `#template` that a child calls reads the contexts of the child in the browser render, as on the server.
- `renderedTemplate` (packages/brumate/src/runtime/client/inserts.ts) tests the range of the insert for `t` as well as `l`, so in-place updates still tell calls at one scope apart.
- `template-context` and its `diverge(...)` leave `test/differential/data.ts`; `tplContextListPage` is a same page.
- New guard fixture `test/render/tplContextInFilePage.brm`: `<TplProvider>{row('inside')}</TplProvider>`.
- Changeset `.changeset/template-context.md` (patch, brumate).

## Proof

- base: fa137b5b, `npx vitest run test/differential-3.test.ts -t tplContextListPage` with the divergence removed: fails, "The context tpl-level-store has no provider above this component".
- branch: the same command passes.

## Deviations

- No new resume test: the differential test is the browser render of the page, and resume.test.ts already covers the server side.

## Stubs left

- None.

## Gotchas

- 4dc4d6d0 marked calls lexical to keep old behavior only; no in-file case needed it. The in-file call inside a provider's children already matched the server on the base.
- `scope.t === at` alone is not enough to find a template's scope; it needs the range test.

## Proposed learnings

- A scope that a render makes reads contexts through `t` only when the render pushes `{ from, at }` | keeps browser and server equal | packages/brumate/src/runtime/client | yes (differential test)

## Verification

- pnpm lint ok; typecheck ok; format:check fails only on 13 docs files that fail on the base too. pnpm test in packages/brumate: 3262 of 3263; the one failure ("stops updates that keep writing") passes alone (load). e2e website,ui: ui PreviewTrigger fails on the base too ("it showed before its delay"). Todos bench: client JS in dist 84.9 kB / 29.9 kB, total JS after use 33.2 kB / 13.8 kB.

## Size

- Estimated M, actual S: two small edits; the in-place lookup needed one more condition.
