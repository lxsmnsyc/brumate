# Outcome: field-error-clears

## Built

- `recheck()` in packages/ui/src/ColorField.brm and NumberField.brm: after a submit, the native error follows the input on typing and after the blur commit.
- Test packages/ui/test/field-error-clears.test.ts, fixture packages/ui/test/fixtures/field-errors.brm, changeset .changeset/field-error-clears.md.

## Deviations

- The Chrome check was not done; the tests run in happy-dom. A new test file and fixture were added instead of editing existing ones (inside `packages/ui/test/**`).

## Stubs left

- None.

## Gotchas

- Stepping with keys or wheel on an errored field does not re-check; the next input or blur does.

## Proposed learnings

- A part that shows native errors after a submit must re-check on input | TextField, ComboBox, ColorField and NumberField share the shape | packages/ui/src | no

## Verification

- Both new tests fail on main source (the error text stays), pass after the fix.
- color-field, numberfield, validation and form-reset tests pass.
- pnpm lint, format:check, typecheck: see the PR.

## Size

- Estimated S, actual S.
