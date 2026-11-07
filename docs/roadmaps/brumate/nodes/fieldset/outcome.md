# Outcome: fieldset

## Built

- `Fieldset` and `Legend` (packages/ui/src/Fieldset.brm, Legend.brm). `Fieldset` renders `<fieldset>` with `disabled` and `data-disabled` when it, or a Fieldset or Form above it, is disabled.
- `DisabledContext` in packages/ui/src/contexts.ts: a store of a boolean. `Fieldset` and `Form` provide it, each joined with the one above it. `Form` takes a new `isDisabled` prop and sets `data-disabled`.
- 22 parts read it and join it with their own `isDisabled`: TextField, SearchField, NumberField, TokenField, Select, ComboBox, Switch, Slider, DateField, TimeField, DatePicker, DateRangePicker, ColorField, ColorSlider, ColorArea, ColorWheel (a local `isDisabled` memo over `isDisabled: ownDisabled`), and Checkbox, Radio, Button, ToggleButton, Input, TextArea (the `disabled` memo).
- Tests: packages/ui/test/fieldset.test.ts with test/fixtures/fieldsets.brm (6 tests: legend, disabled fields post nothing, nested fieldset, enabled fieldset untouched, enabling again, disabled form).
- Docs: website/ui/fieldset.md with demos FieldsetDemo, FieldsetAnatomy, FieldsetStyled; the card through `summary` and an entry in website/src/ui-groups.ts (Forms); `.ui-fieldset` rules in website/src/routes/ui/_layout.brm.
- Example: examples/ui/src/sections/FieldsetSection.brm and two lines in sections.brm. E2E: e2e/suites/ui/fieldset.mjs and a line in index.mjs.
- Changeset .changeset/fieldset.md (minor, @brumate/ui).

## Deviations

- Added test/fixtures/fieldsets.brm, outside the owned list (a new fixture file).
- `.ui-fieldset` rules added to website/src/routes/ui/_layout.brm (a shared file).
- CheckboxGroup, RadioGroup and the Table, Menu and Tabs parts do not read the context. Their children (Checkbox, Radio, Button, Tab fields) do, so the inputs are disabled, but the group element shows no `data-disabled` from a Fieldset.

## Stubs left

- None.

## Gotchas

- A part must read the context as `const x = $getContext(Ctx, undefined)` and `const y = x ? $store(x) : undefined` (BRM197). A `false` fallback is refused.
- A field that sets `disabled` on a hidden input (Slider thumb, Switch) needs no change: it reads the part's `isDisabled`, now the joined value.
- Fieldset sets the native `disabled`, so a plain `<input>` inside posts nothing too.
- The name of a Slider is on its SliderThumb, not on the Slider.

## Proposed learnings

- A new part that reads `isDisabled` joins `DisabledContext` in the same line | a Fieldset or Form must reach it | packages/ui/src | no

## Verification

- `pnpm --filter @brumate/ui exec vitest run test/fieldset.test.ts`: 6 passed.
- `pnpm build`, `pnpm lint`, root `npx oxfmt --check`, `pnpm typecheck`: pass.
- `pnpm --filter @brumate/ui test`: 78 files, 796 passed, 1 expected fail.
- `pnpm --filter website build` and `check:samples` (67 samples, 0 problems): pass.
- `node e2e/run.mjs --only ui`: 57 passed, 0 failed.

## Size

- Estimated M, actual M.
