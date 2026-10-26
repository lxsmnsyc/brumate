# Outcome: component-tag-live-props

## Built

- A live prop of a dynamic tag that names a component, such as `<{as} label=(label) />` with `as` set to a component, reaches the component when it changes. The tag is rendered by the server, or in a block that the browser opens.
- Runtime, `packages/brumate/src/runtime/client.ts`: `dynamicNodes` reads the anchor from the tag's `b-b` and passes it to `componentNodes`, which records the child scope in `scope.c[anchor]`. `attr` calls `prop` when that anchor holds a child scope. `dynamic` calls `dynamicNodes` for a component tag, where it repeated that code.
- Runtime, `packages/brumate/src/runtime/server.ts`: `dynamic` passes the same anchor to `component`, so the page state holds the link (`c`) of a tag that the server rendered.
- Project analysis, `packages/brumate/src/project.ts`, `summarize`: a dynamic tag with live value props gives them as live props to each `.brm` import that the file reads as a value. Without it the component's entry has no slot for the prop.
- Tests: `packages/brumate/test/resume.test.ts`, describe "a dynamic tag that names a component", two tests. Fixtures `componentTagLiveProps.brm` and `componentTagLivePropsLate.brm` in `test/render/`, with the existing `Tag.brm`.

## Deviations

- Edited `packages/brumate/src/runtime/server.ts` and `packages/brumate/src/project.ts`, which are outside the brief's paths. The link needs the anchor in the page state, and the live props need the project analysis. Both changes are small.
- Added the fixture `componentTagLivePropsLate.brm` for the block case, beside the owned `componentTagLiveProps.brm`.
- The repro of the brief (`class=(cls)` on `AsLink`, which spreads its rest) passes on main. The failing case is a component that names the prop.

## Stubs left

- None.

## Gotchas

- The live props go to every `.brm` import that the file reads as a value, not only to the component that the tag names at run time. A component imported as a value that never gets the tag keeps the extra slot.
- Only value props (`label=(label)`) are covered. A spread on a component tag still takes the `attrs` path, which `component-tag-handlers` and the spread nodes own. `attr` now sends a value prop to the component for any anchor that holds a child scope.
- The anchor is passed as the string from `b-b` (`as never` in `dynamicNodes`), which works as an object key.
- A component that reaches the tag through a `.ts` re-export or a prop of a parent is not seen as a value import in the file of the tag. Its live props stay static.

## Proposed learnings

- A dynamic tag that can name a component needs the same link and live props as `<Name>` | the project analysis cannot see the target | packages/brumate/src | no

## Verification

- `npx vitest run test/resume.test.ts -t "updates its live props"` in packages/brumate: both tests fail before the change (the first one timed out in the wait for the new text), pass with it.
- `npx vitest run` in packages/brumate: 55 files, 957 tests passed, 5 expected fail.
- `npx vitest run --maxWorkers=2` in packages/ui: 54 files, 505 tests passed.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0.
- `npx oxlint` and `npx oxfmt --check` from the root: exit 0 (oxlint with warnings only).

## Size

- Gzip of `client-*.js` from `npx tsdown`: 30854 B on main, 30892 B with the fix, +38 B (0.04 kB), within 0.05 kB. `produce-*.js`: 3876 B before and after.
- Estimated S, actual S.
