# Outcome: defer-in-browser-render

## Built

Fix 2 of the brief: the project check reports the case across files.

- `analyzeProjectDefers(files, resolve?, props?)` in `packages/brumate/src/project.ts`, exported from `brumate`. It returns, for each file, the `#defer` blocks that sit in the children of a component from another file that renders its children in the browser. Type `BrowserDefer`.
- A component renders a prop in the browser when it reads the prop in a scope that the client creates (`graph.created`), in the children or an attribute of a component that does, or in a template that is called from such a place. Popover and Modal match (Modal through its `box` template and `ModalOverlay`). Blocks in `children`, in a `#template` passed as a prop, and in a page `#template` called in the children are reported.
- `CompileOptions.browserDefers` in `compile.ts` turns each block into the error BRM217: `#defer cannot be in the content of <{name}>, which can render it in the browser. Use #loading with a server function`. The Vite plugin (`vite.ts`) and `brumate check` (`check-command.ts`) pass it.
- Catalog entry BRM217 in `error-catalog.ts`, with `test/error-codes.json`, `website/docs/errors.md` and `skills/brumate/references/errors.md` regenerated.
- Tests: `packages/brumate/test/project-defer.test.ts` (8 tests, including a compile of the ui fixture `defer-overlays.brm` that fails with BRM217); `packages/ui/test/async-overlay.test.ts` reports the blocks of `test/fixtures/defer-overlays.brm` (Popover and Modal) and none for the `#loading` fixture.
- Docs: `website/docs/async-data.md` ("#defer") and `website/ui/async-content.md` say the compiler reports it.
- Changeset `.changeset/defer-in-browser-render.md`, patch.

Fix 1 (a browser fetch of the body) is not built. Design for the maintainer: the request carries the id of the block, which the server finds by rendering the route up to it. A block that only the browser rendered is not in that render. The server would need the component of the block, its props and the scope it renders in, sent from the browser and trusted or signed, and a render path that starts at a component instead of at the route. That is a new protocol next to resume, so the node stopped at fix 2 as the brief says.

## Proof

- base: 6fa90cdc, `pnpm --filter @brumate/ui exec vitest run test/async-overlay.test.ts` with the `it.fails` changed to `it`. Result: 1 failed (`expected null not to be null` at `.defer-field`), 4 passed.
- branch: same command with the new tests. Result: 4 passed. The failing test became a check that the block is reported.

## Deviations

- Edits outside the shared paths, all small: `packages/brumate/src/compile.ts` (option and diagnostic), `vite.ts` and `check-command.ts` (pass the option), `index.ts` (export), `error-catalog.ts` and its generated pages and pin file (BRM217), the new `packages/brumate/test/project-defer.test.ts` and the ui fixture `defer-overlays.brm`.
- The two ui tests that focused the Dialog on a `#defer` fallback were removed. The fixture now fails to compile with BRM217, and the `#loading` tests cover focus on late content.
- BRM217 was taken without a reservation in the brief. No other brief reserves a number above BRM216.

## Stubs left

- None.

## Gotchas

- Covered: `children`, a `#template` that the page passes as a prop (`<Lister row=box />`), a `#template` of the page that is called in such children, and a prop that a part passes on to another part by an attribute.
- Not covered: the language has no slots as props, so markup moves as children or as a `#template`. A template that a part gets through a context or a store, and a `#defer` in a child file that the page imports and renders inside an overlay, are not followed. The second one is not a case of this check: that file's own compile cannot see its parent.
- The message says "can render it in the browser". A component that reads `children` in a scope that the client creates is flagged even when the first server render shows it, such as an `#if` that starts true and changes later. This matches the same-file rule in `graph.ts`.
- Cost: `analyzeProjectDefers` parses, analyzes and builds a graph for every file again on each project scan, next to `analyzeProjectProps`, which does the same parse. Sharing the parse needs an exported shared type between the two functions, so it is left as is.
- The first mount in `async-overlay.test.ts` is cold and can pass the 2 s `waitFor`. Rerun once.

## Proposed learnings

- A check that needs a fact about another file goes in `project.ts` and reaches the compile through a `CompileOptions` field | the compile of one file sees only that file | packages/brumate/src | no

## Verification

- `pnpm --filter @brumate/ui exec vitest run test/async-overlay.test.ts`: 4 passed.
- `vitest run test/project-defer.test.ts test/check-command.test.ts test/skill.test.ts` in `packages/brumate` (with `UPDATE_SKILL=1` to regenerate the pages after the review fixes): 140 passed.
- After the review fixes only the affected files ran, as the machine was loaded. The full run above is from before them.
- `pnpm lint --quiet`, `pnpm format:check`, `pnpm typecheck`: clean.
- Full `vitest run` in `packages/brumate`: 3693 passed, 2 failed, both in `test/module-signals.test.ts` (`loadModule` of the client code, not touched by this node). The file alone passes 60 of 60, so they fail under load. Not compared on the base.

## Size

- Estimated M, actual M.
- Risk estimated medium, measured medium. A project with a `#defer` in the children of an overlay now fails to build. That is the intent, but the rule reads the graph of other files and could flag a case that works.
