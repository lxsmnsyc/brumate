# Outcome: ui-no-defaults-2

## Built

- Nine contexts lost their default: `LocaleContext` (`locale.ts`), `LayerContext` (`layer.ts`), and in `contexts.ts` `InputContext`, `TextAreaContext`, `FieldInputContext`, `FieldErrorContext`, `FormContext`, `CheckboxGroupContext`, `RadioGroupContext`. The unused `noInput` default and the `store` import of `locale.ts` are gone.
- Readers (all in `packages/ui/src`, each now guarded with `$hasContext(C) ? ... : undefined`, and `$hasContext` added to the `brumate/signals` import):
  - `LocaleContext`: the 30 parts that read `localeStore` (Table, ColorSwatchPicker, ColorArea, TimeField, ToggleButtonGroup, DateField, Tree, Calendar, TabList, SliderTrack, Toolbar, Menu, ColorSlider, ColorWheel, Sheet, ColorField, DateRangePicker, Meter, TagList, NumberField, Tooltip, GridList, ColumnResizer, ProgressBar, Slider, ListBox, Popover, SliderThumb and others on the same line). Each keeps `localeStore ?? DEFAULT_LOCALE`; `DEFAULT_LOCALE` is a plain object, not a store, built once in `locale.ts`.
  - `LayerContext`: Popover, Tooltip, ModalOverlay (`parentLayer` is `undefined` outside a layer, so the target is `body` as before).
  - `FormContext`: TimeField, Select, DateField, TextField, DateRangePicker, ColorField, NumberField, ComboBox.
  - `FieldErrorContext`: FieldError, Checkbox (`groupError ?? null` for the error store).
  - `FieldInputContext`, `InputContext`, `TextAreaContext`: Input and TextArea (`handlers?.onChange?.(...)`, `slotProps` takes `undefined`).
  - `CheckboxGroupContext`, `RadioGroupContext`: Checkbox and Radio (`groupGiven!.toggle!` under `if (group)`, `groupGiven?.select?.(...)`).
- Test fixture `packages/ui/test/fixtures/Locale.brm` reads `LocaleContext` with the guard.
- `.changeset/ui-no-defaults-2.md`: `@brumate/ui`, minor.
- Idiom as in has-context's outcome. A reader with no provider gets `undefined`, which behaves like the old `null` default.

## Result

Not an experiment node.

Example client JS (`examples/ui`, `vite build --outDir dist/client`, gzip -9 summed over every `.js`): 203,017 B before (ui-no-defaults-1 outcome), 203,139 B after (+122 B, the longer guards).

## Deviations

- The brief says the ui tests and `node e2e/run.mjs --only ui` pass. They cannot until group 4, since contexts of later groups throw. e2e not run.
- `FieldInputContext` has one more reader pattern than listed: Menu, ListBox and ComboBox only set it; nothing to change there.

## Stubs left

- Contexts still with a default (TS2554 count 51 before, 42 after): `DisclosurePanelContext`, `DisclosureGroupContext`, `OverlayTriggerContext`, `DialogContext`, `ModalOverlayContext`, `ColorSwatchContext`, `ColorPickerContext` and the rest in `contexts.ts`, plus `collection.ts`, `calendar.ts`, `menu.ts`, `navigation-tree.ts`, `slider.ts`, `table.ts`, `tabs.ts`, `tags.ts`, `tooltip.ts`, `toast.ts`, `token-field.ts`, `tree.ts`, `virtualizer.ts`, `transition.ts`, `segments.ts`, `selection-indicator.ts`, `date-strings.ts`, `color-thumb.ts`, `color-wheel.ts`.
- Ui test files that fail now (47 of 75, 63 before). No failure throws on a group 2 context: none names `locale`, `layer`, `input`, `textarea`, `field-input`, `field-error`, `form`, `checkbox-group` or `radio-group`. By the context they throw on, all owned by groups 3 and 4 (this node cannot split group 3 from 4; the brief of group 3 decides):
  - `brumate-ui:overlay-trigger`, `modal-overlay`, `disclosure-group`, `menu-trigger`, `virtualizer`, `list-box-given`, `collection-focus`, `date-strings`, `color-picker`, `color-swatch`, `date-picker`, `date-range-field`, `table-resize`, `transition`.
  - Files: as-collections, as-controls, autocomplete, bind-kept-writes, calendar, change-handlers, color-area, color-field, color-picker, color-precision, color-slider, color-swatch-picker, color-swatch, color-wheel, combobox-fixes, combobox (virtualizer), data, date-field-sync, date-i18n, datefield, datepicker, daterangepicker, disclosure, field-error-clears, generics-markup, gridlist, handler-order, i18n-locale-change, indicator, listbox, menu, modal, navigation-tree, popover, range-calendar, refused-writes, reorder, resize, select, skill, start-open, table, timefield, token-field-sync, transition, tree, virtualizer.
- Passing now that failed after group 1: I18nProvider, fields, validation, boxes, form-reset, toolbars, toolbarFixes, slider, tabs, taggroup, numberfield, token-field and others (16 files).

## Gotchas

- `$hasContext` must be imported from `brumate/signals` in each `.brm`; without it the typecheck says "Cannot find name".
- A test fixture that reads a context itself needs the guard too (`Locale.brm`).
- The zsh `==` at the start of an echo argument is read as a command; not a repo issue.

## Proposed learnings

- None new beyond ui-no-defaults-1's.

## Verification

- `npx oxlint`: 0 errors (warnings only). Root `npx oxfmt --check`: pass.
- `brumate-tsc --noEmit` in packages/ui: 51 TS2554 before, 42 after; no other error.
- `npx vitest run` in packages/ui: 47 files fail (396 tests), 28 pass; before, 63 of 75 files failed. Every failure throws on a context of group 3 or 4 (counted above).
- `node e2e/run.mjs --only ui`: not run (group 4).

## Size

- Estimated M, actual S to M: 36 files of mechanical edits.
