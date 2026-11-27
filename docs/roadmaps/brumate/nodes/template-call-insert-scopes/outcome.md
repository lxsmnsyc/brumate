# Outcome: template-call-insert-scopes

## Built

- Server: every call of a `#template` of the file is a `Lazy` value. `emitTemplate` in `packages/brumate/src/codegen/markup.ts` emits the call wrapper `box(...) -> $$b.templateCall(ref, owner, box$, args)` in both modes, for every template, also one with no slots or with a destructured default. `templateCall` in `packages/brumate/src/runtime/server.ts` renders the body at each insert, so each insert has its own scope.
- Page state: the call is registered in `functionReferences` with `FunctionReference(ref, owner, args)`, so a slot or a context value that holds it sends `$b.f("Page#T2", owner, args)`.
- A template passed as a prop (`item=box`): the server's `fn` wrapper gives the call it makes the reference of the inner call, so a memo of `item(n)` in the child sends `Page#T2` too. Before, it crashed `ChildrenPlugin` in `runtime/serial.ts`.
- `ChildrenPlugin` matches only children that hold a reference. Children with none send their HTML through `RawPlugin`.
- Client: `callable` in `runtime/client/handlers.ts` turns a reference to `#T<n>` (`isTemplateCall` in `client/code.ts`) into a `TemplateCall` made by `sentCall` in `client/children.ts`.
- Client: the `T<n>` export renders the sent call. `emitSentCall` in `codegen/client.ts` puts it in the update part. It is emitted only for a template that some site calls or passes other than as the whole expression of an insert (`sentTemplates`). The update part imports the components of those templates (`sentScopes` in `partScopes` and `placeCode`).
- Client: `RawNodes.take()` gives a copy of the nodes to a second insert of one output.
- Client: `handlerExport` in `codegen/client.ts` keeps the template code around an arrow handler that calls a template. Before, `() => (shown = box(2))` threw `box is not defined`.
- Removed the client workaround `sharedScopes` (`client/state.ts`, `client/blocks.ts`, `client/inserts.ts`, `client/resume.ts`). No part of it stays.
- Removed the `memo-template-twice` cause and divergence from `packages/brumate/test/differential/data.ts`.
- Test pages in `packages/brumate/test/render/`:
  - `constTemplateTwice`, `constTemplateThrice`, `signalTemplateTwice`, `signalTemplateThrice`.
  - `propTemplateTwice`, `propTemplateThrice` (children `TemplatePropTwice`, `TemplatePropThrice`).
  - `signalTemplateLater`, `signalTemplateComponent` (a template that renders `TplItem`).
  - `propTemplateStatic` (child `TemplatePropLater`), `contextTemplateStatic` (child `ContextTemplateLater`, context `callContext.ts`).
  - `memoTemplateDestructured`, `passedTemplateMemo` (child `PassedTemplateKid`).
- Resume tests in `packages/brumate/test/resume.test.ts` for each page above.
- Docs: `website/docs/reference-serialization.md` (a call is sent as a reference) and a `docs/decisions.md` entry for the `T<n>` reference.
- Minor changeset `.changeset/template-call-insert-scopes.md`.

## Proof

- base: `53c27248` with the `memo-template-twice` entry removed, `npx vitest run test/differential -t memoTemplate` in `packages/brumate`. Both pages fail: the browser has `2: [1]` once per insert and the server once, and the memo slot holds markup on the server and the call in the browser. With the first new pages, `-t "TemplateTwice|TemplateThrice|TemplatePropT"` fails 8 of 12 on base.
- branch: the same command passes 12 of 12.
- Review round: on 05eccffb (the first PR commit), `npx vitest run test/resume.test.ts -t "no slots|context value of|destructured default|prop passes|component in a #template call"` fails 5 of 5. On the branch it passes 5 of 5.

## Deviations

- `packages/brumate/src/runtime/serial.ts` (not in the brief's paths): `FunctionPlugin` accepts an object in `functionReferences`, and `ChildrenPlugin` skips children with no reference. It sends the call with the existing `$b.f` record, so no new state letter, plugin or reference class.
- `packages/brumate/test/__snapshots__/render/list.txt`, `template-update.txt` and `blocks.txt` (not in the brief's paths): the code of a template now has the `templateCall` wrapper.
- `packages/brumate/test/differential/run.ts`: `plain` prints a `TemplateCall` as its `ref`, its owner by the place of the scope in the page, and its arguments.
- `docs/decisions.md` and `website/docs/reference-serialization.md` (not in the brief's paths), asked by the review.
- The handler fix, the `RawNodes` copy and the `ChildrenPlugin` crash are bugs on base that the new pages showed. The brief asks for those kinds, so they are fixed here.

## Stubs left

- None.

## Gotchas

- A template call on the server no longer renders when it is called, only when it is inserted. The body runs once for each insert, and never for a call that no insert shows. A memo of a template call is no longer a promise on the server.
- A call made outside a `#try` and inserted inside it is caught on the server and escapes in the browser. This is on base too, and the orchestrator makes it a separate node.
- The `T<n>` export duplicates the template code that a memo or handler part already inlines. The memo part does not call `T<n>`: the inlined code reads the scope through `$$p` as the other parts do, and the change was not small. Only pages that store a template call in a value pay for it. todos has no template.
- `sentTemplates` decides on the export by sites. A template that only a direct insert `{box(n)}` calls gets none. Such a call is never in a slot, so the server sends no reference for it.

## Proposed learnings

- None.

## Verification

- Root `pnpm build && pnpm test`: every package passes (`packages/brumate` 3768 tests, `packages/ui` 846 and 2 expected fails, including `test/client-part-imports.test.ts`).
- `node e2e/run.mjs --no-build` after that build: every suite passes (website 81, ui 61, todos 10, tracker 18, printed 13 and the rest).
- `pnpm lint` (warnings only, none new), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm bench --only brumate --scenario todos`, JS before `load`: base 814aa306 35.4 kB / 14.6 kB gzip, branch 35.5 kB / 14.6 kB gzip. The review round changed no runtime file of the client.

## Size

- Estimated L, actual L.
- Risk estimated high, measured high. Every `#template` on the server now renders at its insert, and the page state sends calls in a new form.
