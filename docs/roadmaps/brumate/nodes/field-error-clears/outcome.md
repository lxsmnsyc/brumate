# Outcome: field-error-clears

## Built

- `recheck()` in packages/ui/src/ColorField.brm and NumberField.brm: after a submit, the native error follows the input on typing and after the blur commit.
- Test packages/ui/test/field-error-clears.test.ts, fixture packages/ui/test/fixtures/field-errors.brm, changeset .changeset/field-error-clears.md.

## Deviations

- The Chrome check is a new step in e2e/suites/website.mjs (outside the brief's paths), on /ui/color-field and /ui/number-field. A new test file and fixture were added instead of editing existing ones (inside `packages/ui/test/**`).

## Stubs left

- None.

## Gotchas

- `keyDown`, `wheel` and the step buttons of NumberField now call `pressed`/`scrolled` and then `recheck()`, so arrows, Page keys, Home/End, Enter and the wheel re-check.

## Proposed learnings

- A part that shows native errors after a submit must re-check on input | TextField, ComboBox, ColorField and NumberField share the shape | packages/ui/src | no

## Verification

- Both new tests fail on main source (the error text stays), pass after the fix.
- color-field, numberfield, validation and form-reset tests pass.
- Key-step tests fail without the keyDown recheck, pass with it. `node e2e/run.mjs --only website`: 68 passed, 1 failed (the known /docs/control-flow "10 live samples render"); the new step passes.
- pnpm lint, format:check, typecheck: see the PR.

## Size

- Estimated S, actual S.
