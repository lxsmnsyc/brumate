# Outcome: template-call-insert-scopes

## Built

- Server: a call of a `#template` of the file that has a scope is a `Lazy` value. `emitTemplate` in `packages/brumate/src/codegen/markup.ts` now emits the call wrapper `box(...) -> $$b.templateCall(ref, owner, box$, args)` on the server too, as it did in the browser. `templateCall` in `packages/brumate/src/runtime/server.ts` renders the body at each insert, so each insert has its own scope.
- Page state: the call is registered in `functionReferences` with `FunctionReference(ref, owner, args)`, so a slot that holds it sends `$b.f("Page#T2", owner, args)`.
- Client: `callable` in `runtime/client/handlers.ts` turns a reference to `#T<n>` (`isTemplateCall` in `client/code.ts`) into a `TemplateCall` made by `sentCall` in `client/children.ts`. It renders with the new `T<n>` export of the update part, which `emitSentCall` in `codegen/client.ts` emits for a template that some site calls other than as the whole expression of an insert.
- Client: `RawNodes.take()` gives a copy of the nodes to a second insert of one output. A `const` of a template with no scope shown twice left the first insert empty in markup that the browser renders.
- Client: `handlerExport` in `codegen/client.ts` keeps the template code around an arrow handler that calls a template. Before, `() => (shown = box(2))` threw `box is not defined`.
- Removed the client workaround `sharedScopes` (`client/state.ts`, `client/blocks.ts`, `client/inserts.ts`, `client/resume.ts`). No part of it stays.
- Removed the `memo-template-twice` cause and divergence from `packages/brumate/test/differential/data.ts`.
- Test pages in `packages/brumate/test/render/`: `constTemplateTwice`, `constTemplateThrice`, `signalTemplateTwice`, `signalTemplateThrice`, `propTemplateTwice`, `propTemplateThrice` (children `TemplatePropTwice`, `TemplatePropThrice`), `signalTemplateLater`, next to the existing `memoTemplateTwice` and `memoTemplateThrice`.
- Resume tests in `packages/brumate/test/resume.test.ts`:
  - one scope per insert for the memo.
  - updates after resume for a signal and a prop, at two and three inserts.
  - a `const` at three inserts.
  - a sent call inserted by an `#if` that opens later.
- Minor changeset `.changeset/template-call-insert-scopes.md`.

## Proof

- base: `53c27248` with the `memo-template-twice` entry removed, `npx vitest run test/differential -t memoTemplate` in `packages/brumate`. Both pages fail: the browser has `2: [1]` once per insert and the server once, and the memo slot holds markup on the server and the call in the browser. With the new pages, `-t "TemplateTwice|TemplateThrice|TemplatePropT"` fails 8 of 12 on base.
- branch: the same command passes 12 of 12.

## Deviations

- `packages/brumate/src/runtime/serial.ts` (not in the brief's paths): `FunctionPlugin` accepts an object in `functionReferences`, not only a function. One test line. It sends the call with the existing `$b.f` record, so no new state letter, plugin or reference class.
- `packages/brumate/test/__snapshots__/render/list.txt` and `template-update.txt` (not in the brief's paths): the server code of a template now has the `templateCall` wrapper.
- `packages/brumate/test/differential/run.ts`: `plain` prints a `TemplateCall` as its arguments, since its owner scope and render function have identities, as it already does for functions, nodes and scopes.
- The handler fix and the `RawNodes` copy are bugs on base that the signal and `const` pages showed. The brief asks for those kinds, so they are fixed here.

## Stubs left

- None.

## Gotchas

- A template call on the server no longer renders when it is called, only when it is inserted. An error in the template body now throws at the insert, as in the browser. A memo of a template call is no longer a promise on the server.
- The `T<n>` export duplicates the template code that a memo or handler part already inlines. Only pages that store a template call in a value pay for it. todos has no template.
- `calledAsValue` decides on the export by sites. A template that only a direct insert `{box(n)}` calls gets none. Such a call is never in a slot, so the server sends no reference for it.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/resume.test.ts test/render.test.ts test/differential test/differential.test.ts test/clone-bodies.test.ts` in `packages/brumate`, after merging `origin/release/0.10` (814aa306): 8 files, 1359 tests passed.
- `npx vitest run` in `packages/brumate` before that merge: 3 failures, the two render snapshots (updated) and `clone-bodies.test.ts`, which 814aa306 fixes on `release/0.10`.
- `node e2e/run.mjs`: all suites pass but one website step, "the overlays open, save, close and give focus back" (Escape left the tooltip). `node e2e/run.mjs --only website --no-build` alone: 81 passed, 0 failed.
- `pnpm lint` (warnings only, none new), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm bench --only brumate --scenario todos`, JS before `load`: base 814aa306 35.4 kB / 14.6 kB gzip, branch 35.5 kB / 14.6 kB gzip.

## Size

- Estimated L, actual L.
- Risk estimated high, measured medium. The server change touches every template with a scope, and the render, resume, differential and e2e suites pass.
