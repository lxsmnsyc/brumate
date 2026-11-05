# Outcome: ui-no-defaults-1

## Built

- Ten contexts in `packages/ui/src/contexts.ts` lost their default: `ButtonContext`, `HeadingContext`, `TextContext`, `LabelContext`, `SeparatorContext`, `GroupContext`, `LinkContext`, `ToggleButtonContext`, `ToolbarContext`, `ToggleGroupContext`.
- Readers changed (all in `packages/ui/src`): Button, Link, ToggleButton, ToggleButtonGroup, Toolbar, Heading, Text, Label, Separator, Group, and the readers of these contexts in other groups' parts: Checkbox (`LabelContext`, `TextContext`), TooltipTrigger (`ButtonContext`), PreviewTrigger (`ButtonContext`, `LinkContext`), Breadcrumb (`LinkContext`). Only the lines that read the group 1 contexts changed in those four.
- `.changeset/ui-no-defaults-1.md`: `@brumate/ui`, minor.
- Idioms (from has-context):

```ts
const context = $hasContext(TextContext) ? $store(TextContext) : undefined;
const given = $hasContext(ButtonContext) ? $getContext(ButtonContext) : undefined;
const state = $hasContext(ButtonContext) ? $store(given.state) : undefined;
const nested = $hasContext(ToolbarContext);
```

Handlers read `given?.handlers`, `groupGiven?.toggle?.(id)`. `slotProps` and `slotHandlers` already take `undefined`. No fallback value is built; `undefined` means no context.

## Result

Not an experiment node.

Example client JS (`examples/ui`, `vite build --outDir dist/client`, gzip -9 summed over every `.js`): 203,133 B before, 203,017 B after.

## Deviations

- The brief says the ui tests and `node e2e/run.mjs --only ui` pass. They cannot until group 4, since contexts of later groups throw. Not run.
- `ToolbarContext` stays `createContext<boolean>` and is still set to `true`; readers only ask `$hasContext`.

## Stubs left

- Contexts still with a default (TS2554 count 61 before, 51 after): all other contexts in `contexts.ts` (InputContext, TextAreaContext, FieldInputContext, FieldErrorContext, FormContext, CheckboxGroupContext, RadioGroupContext, DisclosurePanelContext, DisclosureGroupContext, OverlayTriggerContext, DialogContext, ModalOverlayContext, ColorSwatchContext, ColorPicker and the rest below it) and in `collection.ts`, `calendar.ts`, `menu.ts`, `navigation-tree.ts`, `layer.ts`, `locale.ts`, `slider.ts`, `table.ts`, `tabs.ts`, `tags.ts`, `tooltip.ts`, `toast.ts`, `token-field.ts`, `tree.ts`, `virtualizer.ts`, `transition.ts`, `segments.ts`, `selection-indicator.ts`, `date-strings.ts`, `color-thumb.ts`, `color-wheel.ts`.
- Ui test files that fail now (63 of 75, full run), by the context they throw on; none throws on a group 1 context:
  - `brumate-ui:locale` (group 4): I18nProvider, as-collections, as-controls, bind-kept-writes, change-handlers, color-picker, data, date-field-sync, datefield, daterangepicker, gridlist, indicator, listbox, navigation-tree, numberfield, refused-writes, reorder, resize, slider, table, tabs, taggroup, timefield, toolbarFixes, toolbars, tree, virtualizer (and others also listed below).
  - `brumate-ui:layer` (group 4): combobox-fixes, handler-order, menu, modal, overlay-offscreen, popover, preview, tooltip, start-open, style-merge.
  - `brumate-ui:form`, `field-input`, `checkbox-group` (group 2): combobox, date-i18n, i18n-locale-change, select, fields, validation, boxes, form-reset.
  - `brumate-ui:color-picker`, `color-swatch`, `date-picker`, `date-strings`, `disclosure-group`, `transition`, `overlay-trigger`, `modal-overlay` (group 4): calendar, range-calendar, datepicker, color-area, color-field, color-precision, color-slider, color-wheel, color-swatch, field-error-clears, disclosure, transition.
  - `brumate-ui:menu-trigger` (group 3 or 4, by the brief of group 3 for menus): autocomplete.
  - Files with only follow-on errors: skill (all groups), color-swatch-picker, generics-markup, token-field-sync.
- Locale makes toolbars.test.ts and toolbarFixes.test.ts fail, so the Toolbar and ToggleButtonGroup changes are checked by typecheck, not by those tests, until group 4.

## Gotchas

- `$store(given.state)` must be guarded by the same context as `given`: `$hasContext(ButtonContext) ? $store(given.state) : undefined`.
- A `$toStore(memo)` of a value that may be `undefined` fails typecheck against `StoreLike<... | null>`; Checkbox writes `groupLabel ?? null`.
- `sed -i` on this machine (BSD) takes the next argument as a suffix; use perl for in-place edits.
- Button.test.ts failed two pointer tests in the full run under load and passes alone.
- To typecheck ui in a fresh worktree, run `npx tsdown` in packages/brumate, packages/language-core and packages/tsc first.

## Proposed learnings

- A part that must render alone reads its context with `$hasContext(C) ? $store(C) : undefined` and passes `undefined` to `slotProps` | no module-scope fallback is shared between requests | packages/ui/src | no

## Verification

- `npx oxlint`: 0 errors (warnings only). Root `npx oxfmt --check`: pass.
- `brumate-tsc --noEmit` in packages/ui: 61 TS2554 before, 51 after; no other error.
- `npx vitest run` in packages/ui: 63 files fail, 12 pass; classified above. Button, simple and state tests pass alone.
- `node e2e/run.mjs --only ui`: not run (group 4).

## Size

- Estimated M, actual S to M: 14 source files and a changeset.
