# Outcome: component-tag-live-props

## Built

- A live prop of a dynamic tag that names a component, such as `<{as} label=(label) />` with `as` set to a component, reaches the component when it changes. The tag is rendered by the server, or in a block that the browser opens.
- Runtime, `packages/brumate/src/runtime/client.ts`: `dynamicNodes` reads the anchor from the tag's `b-b` and passes it to `componentNodes`, which records the child scope in `scope.c[anchor]`. `attr` calls `prop` when that anchor holds a child scope. `dynamic` calls `dynamicNodes` for a component tag, where it repeated that code.
- Runtime, `packages/brumate/src/runtime/server.ts`: `dynamic` passes the same anchor to `component`, so the page state holds the link (`c`) of a tag that the server rendered. It takes `b-b` out of the props, so a component that spreads `...rest` does not hold an `Internal` in a live rest slot. The scoped `b-on` that the compiler writes (#262) is an `Internal` too, so `dynamic` turns each of its entries into an `onClick`-style prop that refers to the client function (a `FunctionReference`, with its modifiers), as the handler of a component written by name is. The page state sends it, a live rest holds it, and a spread writes it again after an update or a re-render in the browser. A handler of the same event that a rest prop passed on is merged with the tag's: one function calls the existing handler first, then the new one, with the same arguments, and keeps its parts in a list under the symbol `brumate.parts` (`PARTS` in `shared.ts`). Merging a merged function flattens the list, so any number of handlers works, and a component that calls `props.onClick(event)` runs all of them. A plain `Internal` plugin that writes `void 0` was tried and dropped: the handlers would be lost when the browser renders the spread again.
- Runtime, `client.ts`: `dynamicNodes` takes `b-b` out of the props of a component too, so it is not in the `b-s` of the element and a later spread diff cannot remove the own anchor.
- Project analysis, `packages/brumate/src/project.ts`: `summarize` marks a dynamic tag's usages with `dynamic`. `analyzeProjectProps` gives a live value prop of such a tag only to the `.brm` imports that the file reads as a value and whose props declare that name (a named prop, the rest, or the props object).
- Tests: `packages/brumate/test/resume.test.ts`, describe "a dynamic tag that names a component", two tests. Fixtures `componentTagLiveProps.brm` and `componentTagLivePropsLate.brm` in `test/render/`, with the existing `Tag.brm`. Handlers: `restTagHandler.brm` and `restTagHandlerLate.brm` (a dynamic tag with a live `title` and an `onClick`, clicked, toggled and clicked again, server and block; the first also checks that `b-s` has no `b-b`). Regression of the node rest-prop-handlers: `restLiveProp.brm` gives the real AsLink a live prop (`<AsLink title=(String(flag)) href="/q">`), and the six tests of "a component in a prop" pass with it. Review fixes: `restTagLiveProps.brm`, `restTagLivePropsLate.brm` and `RestLink.brm` (a copy of AsLink, which spreads its rest) with a live `title` and a `class` object, on the server and in a block, and a project test that `Other` (no `label` prop) gets no live props.

## Deviations

- Edited `packages/brumate/src/runtime/server.ts` and `packages/brumate/src/project.ts`, which are outside the brief's paths. The link needs the anchor in the page state, and the live props need the project analysis. Both changes are small.
- Added `RestLink.brm` beside AsLink, because a live rest on the shared AsLink breaks other tests (see Gotchas).
- Added the fixture `componentTagLivePropsLate.brm` for the block case, beside the owned `componentTagLiveProps.brm`.
- The repro of the brief (`class=(cls)` on `AsLink`, which spreads its rest) passes on main. The failing case is a component that names the prop.

## Stubs left

- None.

## Gotchas

- The live props go to every `.brm` import that the file reads as a value and whose props declare the name, not only to the component that the tag names at run time.
- Gap 1: a component reached through a `.ts` re-export, or through a parent's prop, keeps static props. Repro: `Q.brm` has `const { as } = $props(); <{as} label=(label) />` where `label` is live, and a page has `<Q as=T />`. Q does not read `T` as a value import, so T gets no live `label`.
- Gap 2: a spread, a live handler or a computed attribute on a component tag goes through `attrs` and stays static. Repro: `<{as} {...props}>`, `<{as} onClick=(handler)>` or `<{as} [name]=(x)>` with `as` set to a component and the value changing. Only value props go through `prop` now.
- This PR fulfils the node rest-prop-handlers. Its bug (a live rest holding an `Internal`, either `b-b` or a `b-on` entry) had the same root cause. `restLiveProp.brm` is in the test project, so AsLink has live rest props there, and the six tests of "a component in a prop" pass. Its brief names the fixture `restLiveProp.brm`, which this PR uses. The fixtures `RestLink.brm` stay for the dynamic tag tests.
- Handlers of one event on a component tag have no limit. `mergeHandlers` and `addEntryHandlers` in `shared.ts` merge them, in the order: the rest prop's handler, then the tag's own entries as they appear. The server's `spread` and the client's `spreadEntries` write one `b-on` entry for each part. The page state writes a merged handler as `$b.m([...])` (`MergedPlugin` in `serial.ts`), an array of function references that `callable` in the browser turns into one function again. Parts without a client function are left out of the state.
- The client's `dynamicNodes` turns the scoped `b-on` of a component tag into handler props too, as the server does. Before, it passed `b-on` on as a string prop, and a `b-on` of an inner tag replaced it, so a rest prop's handlers were lost in a block.
- Both the server and the client take `b-b` out of the props of a component tag. The handlers carry their scope in the entry (`@scope`) since #262, so the element needs no `b-b` for them.

## Proposed learnings

- A dynamic tag that can name a component needs the same link and live props as `<Name>` | the project analysis cannot see the target | packages/brumate/src | no

## Verification

- `npx vitest run test/resume.test.ts -t "updates its live props"` in packages/brumate: both tests fail before the change (the first one timed out in the wait for the new text), pass with it.
- `npx vitest run` in packages/brumate: 972 tests passed, 5 expected fail.
- `npx vitest run --maxWorkers=2` in packages/ui: exit 0.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0.
- `npx oxlint` and `npx oxfmt --check` from the root: exit 0 (oxlint with warnings only).

## Size

- Gzip of `npx tsdown` output (not minified): `client-*.js` 30890 B on origin/main, 30938 B on the PR before the merge design, 31064 B with it (+126 B over the PR, +174 B over main). `produce-*.js` (holds `shared.ts`): 4013 B on main and before, 4591 B after (+578 B). The merge design is over the budget of 0.05 kB: `mergeHandlers`, `addEntryHandlers` and `stateValues.m` are in `shared.ts`, and the browser needs them for the handlers of a component tag, a spread and the page state.
- Estimated S, actual S.
