# Outcome: component-prop-render

## Built

- A component that a prop gets as a value, such as `<LateAs as=AsLink />`, renders in a block that the browser renders later, and in a new `#for` item. Before, `dynamic` and `dynamicNodes` called the stub of the state, which renders `''`.
- Compiler, `packages/brumate/src/codegen/client.ts`: `valueComponents()` finds the `.brm` imports that a component reads as values, outside the sites `server-function`, `event`, `effect` and `client`. The client entry imports each one's render module as `$$v<n>` and exports `components = [$$v0, ...]`. A component with such an import has client code (`clientCode` is true), so a build keeps its entry. An entry without parts exports no parts.
- Compiler, `packages/brumate/src/codegen/render.ts`: each render module sets `<Name>.brumateId = "<id>"` after its function.
- Core, `packages/brumate/src/runtime/client.ts`: `ClientModule.components`, a record `valueRenders` by ID that `loadModule` fills, and a lookup in `dynamic` and `dynamicNodes` when the tag is a function. A tag that is already a render function has no registered ID and stays as it is.
- Tests: `packages/brumate/test/resume.test.ts`, describe "a component in a prop", with fixtures `LateAs.brm`, `lateAsPage.brm`, `LateEach.brm`, `lateEachPage.brm`, and for the review probes `PassAs.brm`, `twoLevelAsPage.brm`, `ContextAs.brm`, `contextAsPage.brm`, `lateAsContext.ts`, `HydratedEach.brm`, `hydratedEachPage.brm`, `AsItalic.brm`, `swapAsPage.brm` in `test/render/`. They use the existing `AsLink.brm`. The six tests cover a block, a new `#for` item, two levels of props, a context, a list through a reverse, and a component that a handler sets.
- Chose the compiler direction over loading by ID. See log.md.

## Deviations

- Merged origin/main (#254 to #256) into the branch; the only conflict was in resume.test.ts, where both sides added a describe.
- Edited the 23 render snapshots in `packages/brumate/test/__snapshots__/render/` (each render module has a `brumateId` line), and added the fixtures `LateEach.brm` and `lateEachPage.brm` for the `#for` item. Both are outside the owned paths.
- Not touched: `packages/brumate/src/runtime/shared.ts`. The stub is unchanged.

## Stubs left

- None.

## Gotchas

- Only the component that sends the value registers it, and `valueComponents()` accepts only imports whose source ends in `.brm`. A component that reaches a prop through a `.ts` re-export is still an empty stub in markup that the browser renders. No fallback was built, by decision of the orchestrator.
- The sender must be on the page: its root scope is in the state, so its entry loads with the page. A value sent by a page that loads later registers when that page's entry loads.
- The registration is by ID, in one record for the whole page. A render module that is not marked, such as one of an older build, is not found and stays a stub.
- `vite.ts` was not changed. I checked the bundle code by reading: `bundleModule` takes the exported names of the entry, so `components` is in the bundle object, and the manifest keeps the entry because `clientCode` is true. No test builds a bundle for this.

## Proposed learnings

- A value that the state holds as an ID needs a registered render function on the client, written by the compiler of the sender | the browser cannot render a stub | packages/brumate/src/codegen | no

## Verification

- `npx vitest run test/resume.test.ts -t "a component in a prop"` in packages/brumate: both tests time out on main, pass with the fix.
- `npx vitest run` in packages/brumate: 55 files passed, 955 tests passed, 5 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0.
- `npx oxfmt --check` from the root: exit 0. `npx oxlint` from the root: exit 0, with warnings only.

## Size

- Gzip of the eager core with `npx tsdown`, `client-*.js`: 30801 B on origin/main (with #254 to #256), 30854 B with the fix, +53 B (0.05 kB). `produce-*.js`: 3876 B before and after. Within the 0.1 kB budget.
- Estimated M, actual M.
