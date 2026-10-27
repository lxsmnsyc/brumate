# Outcome: as-passed-on

## Built

- `packages/brumate/src/project.ts`: `ComponentUsage.components` now maps a prop to a list of `.brm` imports, read from the value and from the branches of `?:`, `??` and `||` (`as=(flag ? A : B)`). The new `ComponentUsage.passed` maps a prop to the own props of the file whose value it is (`<Button {as}>`). `analyzeProjectProps` keeps the components given to each prop of each file, hands them on through `passed`, and gives the live props of the dynamic tags that read the prop to each component that declares them.
- Tests: `resume.test.ts`, describe "a part that passes on the component of as to another part" (fixtures `gapPassOnPart`, `gapPassOnComponent`, `gapPassOnChoice`, `gapPassOnChoiceOther`, `gapPassOnTarget`, `gapPassOnTargetA`, `gapPassOnTargetB`); `project.test.ts` checks both analyses.

## Deviations

- The ToggleButton test of `as-controls.test.ts` stays `it.fails`, so one acceptance criterion is not met. Only its comment changed. See Gotchas.

## Stubs left

- None.

## Gotchas

- The ToggleButton test needs more than the analysis. ToggleButton's `aria-pressed` and `data-selected` reach Button's `...rest`, which Button's dynamic tag spreads. A spread on a component tag stays static in the browser (gap 2 of component-tag-live-props), and in ui `AsTarget` already has every live prop of Button's value attributes. In the ui project the analysis result does not change.
- Tried, and reverted: counting a live spread in `dynamicTags`, and routing `attrs` of a component anchor to `spreadProps`. Together they make the Toolbar focus test, the Disclosure test and the ToggleButton test fail, because the rest of the target becomes live.
- The fixtures use targets that no other fixture names, since the test project analyzes all of `test/render` together.
- Only the identifiers, `?:`, `??`, `||` and parenthesized or typed forms are followed. A component behind a call, a member or an object is not.

## Proposed learnings

- A fixture that tests the project analysis needs components that no other fixture names | the analysis runs over all fixtures at once | packages/brumate/test/render | no

## Verification

- `npx vitest run test/resume.test.ts test/project.test.ts -t "passes on|follows"` in packages/brumate: the 5 new tests fail on main, pass with the change.
- `npx vitest run` in packages/brumate: 988 passed, 6 expected fail.
- `npx vitest run --maxWorkers=2` in packages/ui: 536 passed, 2 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate, `npx oxlint` (warnings only) and `npx oxfmt --check`: exit 0.
- `analyzeProjectProps` on all .brm files of packages/ui (src and test/fixtures), before and after: identical, 158 live props, none new.

## Size

- Runtime unchanged (only the compiler analysis in `project.ts`), so the gzip size of `client-*.js` and `produce-*.js` does not change.
- Estimated S, actual S.
