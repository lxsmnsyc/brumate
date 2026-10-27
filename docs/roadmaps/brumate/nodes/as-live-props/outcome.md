# Outcome: as-live-props

## Built

- `packages/brumate/src/project.ts`: `summarize` records, for each component usage, the props whose value is a `.brm` import (`components`, such as `as=GapTarget`). The new `dynamicTags` lists the dynamic tags of a file that have live value props, with the props their tag expression reads. `analyzeProjectProps` gives those live props to the imported component, when it declares the prop name (a named prop, the rest or the props object). A tag that reads no prop of the part gives nothing.
- `packages/brumate/src/runtime/serial.ts` and `shared.ts`: `InternalPlugin` and `stateValues.i` send an `Internal` value (the scoped style attribute that a part's dynamic tag writes) through the page state. Needed because the target's rest is now live and holds it.
- Tests: `resume.test.ts`, describe "a component that a page gives to a part in as" (fixtures `GapPart.brm`, `GapTarget.brm`, `gapPropsComponent.brm`, `gapPropsElement.brm`); `project.test.ts` checks the analysis. The `spikePage` test matches the link with a regex, since the link now carries `b-b` before `class`.
- packages/ui: `it.fails` became `it` for "updates the attributes that a part gives to a component in as", "updates the checked attribute of a menu item with a component in as" and the Disclosure test of as-controls.

## Deviations

- Edited `runtime/serial.ts` and `runtime/shared.ts`, outside the brief's paths. Without them, 12 ui tests failed (see Gotchas).
- `GapPart.brm` and `GapTarget.brm` are also added by template-value-imports (#276), with the same content.

## Stubs left

- None.

## Gotchas

- Only a component named by an identifier (`as=Target`) is followed. `as=(cond ? A : B)` and a part that passes `as` on to another part (ToggleButton gives `{as}` to Button, with a spread) are not. The `it.fails` test "updates the ARIA of a ToggleButton that is a component" stays.
- A live rest on a target holds the `Internal` of the part's scoped style attribute. Any other `Internal` a dynamic tag adds (`b-v`) would need the same plugin, which now covers every `Internal`.
- The target of `as` now has an anchor (`b-b`) in its server HTML when the part has live props, so tests that match the start tag of such an element in order must allow it.

## Proposed learnings

- A new way to make a prop live needs a run of the whole packages/ui suite | a live rest slot is sent in the page state, and it fails on values that were never sent before | packages/brumate/src | no

## Verification

- `npx vitest run test/resume.test.ts -t "updates a prop that a part sends to its target"`: gapPropsComponent fails on main (timeout), both pass with the fix.
- `npx vitest run` in packages/brumate: 975 passed, 5 expected fail.
- `npx vitest run --maxWorkers=2` in packages/ui: 532 passed, 4 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0. `npx oxlint`: warnings only.
- `npx oxfmt --check`: exit 0.

## Size

- Gzip of `npx tsdown` output: `client-*.js` 31150 B to 31151 B (+1), `produce-*.js` 4581 B to 4603 B (+22). Total +23 B, within the 0.1 kB budget.
- Estimated S, actual S.
