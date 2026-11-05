# Outcome: ui-stores-calendar

## Built

The calendar, date and color contexts hold stores, with the pattern of ui-stores-fields (a named memo, `$toStore(memo)`, `$store(given.state)` in the reader, handlers as literal keys).

- `packages/ui/src/calendar.ts`: `CalendarState` is data only; `CalendarHandlers`, `CalendarGiven` (`{ state, ...handlers }`), `DatePickerGiven`. `CalendarGridContext` holds `StoreLike<{ start } | null>`.
- `packages/ui/src/segments.ts`: `DateFieldHandlers`, `DateFieldGiven`, `DateRangeFieldGiven` (`startState`, `endState`, flat `startStep`... `endSettle`).
- `packages/ui/src/color-thumb.ts`: `ColorThumbHandlers`, `ColorThumbGiven`. `color-wheel.ts`: `ColorWheelGiven`. `contexts.ts`: `ColorPickerGiven`, and `ColorSwatchContext` as a store.
- Providers: `Calendar`, `RangeCalendar` (through Calendar), `CalendarGrid`, `DatePicker`, `DateRangePicker`, `DateField`, `TimeField`, `DateInput` (re-provides the date of its slot), `ColorPicker`, `ColorSwatchPickerItem`, `ColorArea`, `ColorWheel`, `ColorSlider` (thumb).
- Readers: `CalendarCell`, `CalendarGrid`, `CalendarHeading`, `Calendar` (picker), `DateInput`, `DateSegment`, `ColorThumb`, `ColorWheelTrack`, `ColorSwatch`, and the picker reads of `ColorArea`, `ColorField`, `ColorSlider`, `ColorWheel`, `ColorSwatchPicker`.
- `packages/ui/test/field-stores.test.ts`: 15 more parts, and the nine new contexts. It fails on 8ad33cbf and passes here.
- `.changeset/ui-stores-calendar.md` (`@brumate/ui` minor).

## Result

Not an experiment node.

## Deviations

- `DateRangeFieldContext` is flat (`startState`, `endState`, ten handler keys) because a nested handler object and `$store` of a key of a key both fail.
- `ColorField`, `ColorSlider`, `ColorWheel`, `ColorArea`, `ColorSwatchPicker` are in this node as readers and providers of color contexts, though ui-stores-fields touched their field contexts.
- Left on the live path, because their contexts belong to no part of this node: `ButtonContext` of Calendar (previous and next buttons), `TextContext`, `OverlayTriggerContext` of DatePicker and DateRangePicker, `LocaleContext` (28 readers) and `DateStringsContext` (I18nProvider provides both with live values).

## Stubs left

- Live-path uses in these parts: `ButtonContext` (Calendar, DatePicker, DateRangePicker), `OverlayTriggerContext` (DatePicker, DateRangePicker), `TextContext` (Calendar and the date fields, constant), `SliderContext` (ColorSlider, rest node), `ListBoxContext` (ColorSwatchPicker, collections node), `LocaleContext`, `DateStringsContext`.
- `$setContext` warnings in the ui build (unique locations, `vite build` of examples/ui): 152 before, 91 after. Of the 91, eight are in these parts: Calendar 2 (`ButtonContext`), ColorSwatchPicker 1 (`ListBoxContext`) and ColorSlider 5 (`SliderContext`); the rest belong to the collections and rest nodes and to parts no node covers (Disclosure, Tab, Transition, Popover, ModalOverlay, SubmenuTrigger, MenuTrigger, Tooltip, PreviewTrigger, Navigation, Table).
- Handlers still produce an `updateContext` in the client part of each provider; the test checks that none reads changing state by a direct read.

## Gotchas

- A default value of a context must hold no function: the server reads the default through the slot and names "holds a Function". Make the handlers optional and call them with `?.`. Stores in defaults are fine.
- A nested object of handlers in a `$setContext` value fails like a spread. Use flat keys.
- `$store(a.b.c)` is not a source. Give each store its own key.
- `pickerGiven?.isDateUnavailable` in Calendar: a first try without the `?.` threw `Cannot read properties of undefined` in two datepicker tests while a browser-rendered Calendar mounted (the slot of the `$getContext` value was not set when CalendarCell called the handler). A reviewer could not reproduce an effect on the picker's unavailable dates, and I have no repro of one, so this is only the reason for the `?.`.
- The pickers' `setValue` is optional in the type (the default has none). The parts call `given.setValue!(...)` only under `picker && !passed`, where a provider exists and always gives it, so a missing handler there throws instead of dropping the write.
- The scan of the test for the new contexts splits the provided object into keys and flags a key whose value reads state outside a function, since the handlers read state in their body. It counts the scanned updates apart from the field contexts.

## Proposed learnings

- Give a context default no function; make handlers optional | the server cannot send a function default | packages/ui/src | yes (the ui tests fail)

## Verification

- `pnpm lint` (exit 0, warnings only), `pnpm format:check` (pass), `pnpm typecheck` (pass, all packages).
- `npx vitest run` in packages/ui, in four groups, all files except `bind-kept-writes` and `token-field-sync`: 73 files, all pass (1 expected fail).
- field-stores test on 8ad33cbf `packages/ui/src`: fails; here: passes.
- Ui example JS (vite build of `examples/ui`, gzip -9 per file in `dist/assets`, summed): base 8ad33cbf 200,677 B (ui-stores-fields recorded 200,682 B), now 201,986 B (+1,309 B, +0.65%). Not a measure of `load`.
- ui e2e (`node e2e/run.mjs --only ui`): 55 passed, 0 failed.

## Size

- Estimated M, actual M.
