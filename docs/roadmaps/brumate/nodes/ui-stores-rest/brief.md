---
id: ui-stores-rest
title: The remaining parts (checkbox, radio, slider, tag, token, toggle, disclosure, number) read live context values from stores
status: active
priority: must
type: refactor
story: context-stores
outline: false
milestone: 0.7.0
target:
from:
size: L
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns: []
shared:
  - packages/ui/src/**
  - packages/ui/test/**
  - packages/ui/e2e/**
  - examples/ui/**
  - .changeset/*.md
reserves: []
provides: []
depends_on:
  - on: store-contract
    kind: hard
    why: the parts move onto `$store`
  - on: ui-stores-fields
    kind: hard
    why: Checkbox and Switch share the field contexts and its outcome sets the pattern
---

# The remaining parts read live context values from stores

## Goal

A wave of step 3 of the approved context-stores debate (docs/debates/context-stores/debate.md), for the contexts no other ui-stores node covers. ui-stores-fields found them (its outcome, "Stubs left"): `TextContext` (only `hidden` changes, in Checkbox and Switch), `CheckboxGroupContext`, `RadioGroupContext`, `SliderContext`, `TagGroupContext`, `TokenFieldContext`, the toggle and disclosure group contexts, and the `ButtonContext` of NumberField. ui-stores-calendar (2026-11-05) found more that no node had: `ButtonContext`, `TextContext` and `OverlayTriggerContext` as Calendar, DatePicker and DateRangePicker provide them, `LocaleContext` (28 readers; the locale changes, see the i18n-locale-change test) and `DateStringsContext` from I18nProvider. They are yours too. ui-stores-collections (2026-11-05) converted the Table, Tree and NavigationTree contexts too, and left: `SelectionIndicatorContext` whole (8 providers: ListBoxItem, GridListItem, Row, TreeItem, Tab, Radio, Tag, ToggleButton, and its reader), `CheckboxGroupContext` as GridListItem, Row, TableHeader and TreeItem provide it, `ButtonContext` of GridListItem, TreeItem and Select, and `OverlayTriggerContext` of SubmenuTrigger, Select and ComboBox (66 warnings after it). Read its outcome for the file:line list. This node owns every context still on the live path after ui-stores-collections: start from the compiler's `$setContext` warnings across packages/ui (66 after ui-stores-collections) and end at none, or list each one left with the reason it never changes.

Without this node, static-contexts-final would delete the live path these parts still use and they would stop updating.

Each provider that passes a value that changes puts it in one store per provider, and its readers read it with `$store`. Constant values stay plain; a context passed only one level down may become props; context functions stay for handlers only (the debate's P14, P16).

Use the API store-contract shipped and the pattern ui-stores-fields used (read both outcomes on `feat/context-stores`). Every compiler warning that a `$setContext` value reads a local `$signal`, `$memo` or `let` should be gone from these parts when the node is done. Check the remaining warnings across packages/ui at the end, and list any context still on the live path in the outcome.

## Acceptance

- [ ] Every reader of a changing value in these parts reads it from a store; no update part of these parts reads state (extend ui-stores-fields' `field-stores.test.ts` or add a test like it).
- [ ] The ui tests and the ui e2e suite pass; the parts behave the same.
- [ ] The ui example's client JS (gzip, summed over dist chunks, as ui-stores-fields measured it) is recorded before and after.

## Sizing

L: about 15 contexts across many parts, plus the locale readers.
