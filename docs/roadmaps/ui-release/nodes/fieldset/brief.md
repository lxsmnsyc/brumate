---
id: fieldset
title: Fieldset and Legend, with disabled that flows down
status: todo
priority: should
type: feature
target:
from:
size: M
spike: false
verify: pnpm --filter @brumate/ui exec vitest run test/fieldset.test.ts
exclusive: []
fulfilled_by: 
gate: false
added:
owns:
  - packages/ui/src/Fieldset.brm
  - packages/ui/src/Legend.brm
  - packages/ui/src/Form.brm
  - packages/ui/test/fieldset.test.ts
  - website/ui/fieldset.md
  - website/ui/demos/FieldsetDemo.brm
  - packages/ui/src/TextField.brm
  - packages/ui/src/SearchField.brm
  - packages/ui/src/NumberField.brm
  - packages/ui/src/TokenField.brm
  - packages/ui/src/Select.brm
  - packages/ui/src/ComboBox.brm
  - packages/ui/src/Checkbox.brm
  - packages/ui/src/Radio.brm
  - packages/ui/src/Switch.brm
  - packages/ui/src/Slider.brm
  - packages/ui/src/DateField.brm
  - packages/ui/src/TimeField.brm
  - packages/ui/src/DatePicker.brm
  - packages/ui/src/DateRangePicker.brm
  - packages/ui/src/ColorField.brm
  - packages/ui/src/ColorSlider.brm
  - packages/ui/src/ColorArea.brm
  - packages/ui/src/ColorWheel.brm
  - packages/ui/src/TextArea.brm
  - packages/ui/src/Input.brm
  - packages/ui/src/Button.brm
  - packages/ui/src/ToggleButton.brm
shared:
  - packages/ui/src/contexts.ts
  - website/src/ui.ts
  - website/src/routes/ui/_layout.brm
  - examples/ui/src/**
  - e2e/suites/ui/**
reserves: []
provides: []
depends_on:
  - on: as-controls
    kind: hard
    why: both edit the props of RadioGroup, CheckboxGroup and ToggleButton
  - on: docs-controls
    kind: hard
    why: its page follows the props-table format, and it edits the field parts that docs-controls documents
  - on: split-ui-examples
    kind: hard
    why: a new part adds its own example and e2e module
---

# Fieldset and Legend, with disabled that flows down

## Goal

Add `Fieldset` and `Legend`, and a disabled context that `Fieldset` and `Form` provide. Every field part reads it in its `isDisabled` merge, so a disabled fieldset disables the fields inside it.

## Context

- About 25 field parts merge `isDisabled` with their context. Each reads one more context.
- Source: [Disabled and labels that flow down a Fieldset or Field](../../../../proposals.md#3-disabled-and-labels-that-flow-down-a-fieldset-or-field)

## Acceptance

- [ ] A field inside a disabled Fieldset is disabled, and posts nothing.
- [ ] A docs page, an example and an e2e step.
- [ ] `pnpm --filter @brumate/ui exec vitest run` passes.
- [ ] Fast check passes: `pnpm lint && pnpm format:check && pnpm typecheck`

## Sizing

M: two small parts, and one line in about 25 parts.

## Notes for the worker

- Skip `Field` of Headless UI. The field parts already group a label, an input and an error.
