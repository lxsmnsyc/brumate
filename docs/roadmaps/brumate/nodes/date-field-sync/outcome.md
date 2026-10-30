# Outcome: date-field-sync

## Built

- A DateField, and the field of a DatePicker, show the kept date after a refused `$bind` write and after a reset: `reset()` in `packages/ui/src/date-field.brm.ts`, called from `DateField.brm`.
- DateField, DatePicker and DateRangePicker follow an I18nProvider locale that changes at run time (memos for the locale and the placeholders).
- A date outside `minValue`/`maxValue` sets a custom validity on the hidden input, so a submit is blocked and the FieldError shows the message (DateField, and the start input of DateRangePicker).
- `data-hovered` on CalendarCell and DateSegment, `data-focus-visible` on DateSegment.
- Tests: `packages/ui/test/date-field-sync.test.ts` with `fixtures/date-field-sync.brm`. Changeset `.changeset/date-field-sync.md` (patch).
- Docs: dropped the notes on date-field, date-picker, date-range-picker and state.

## Deviations

- `formField` (shared with TimeField) got an optional third argument, so TimeField is unchanged.
- The pages `website/ui/calendar.md` and `website/ui/range-calendar.md` still say a cell has no `data-hovered`. They are outside this node's paths, so a later docs node should update them. The CSS demos of the date pages still use `:hover`.
- The message text 'The date is outside the allowed range.' is English only and not in DateStrings.

## Stubs left

- None.

## Gotchas

- An argument to a `.brm.ts` function stays reactive only as a plain name. `locale.locale` is read once, so wrap it in a `$memo`.
- Type imports in `date-field.brm.ts` clash with the component's when a new exported function names them (a `DateString` parameter failed to compile); the new `reset` takes `string | null`.
- The ui suite is flaky under parallel load (calendar, timefield, form-reset failed in a full run and passed alone). Not related to this change.

## Proposed learnings

- Pass a memo, not a member expression, to `.brm.ts` functions when the value can change | members are read once | packages/ui/src | no

## Verification

- Before the fix 4 of 5 new tests failed on main code (bugs 1, 2, 3 and hover); after, `npx vitest run test/date-field-sync.test.ts` passes (vitest runs in Chrome).
- `pnpm lint` has no errors, `pnpm format:check` passes, `pnpm --filter @brumate/ui typecheck` passes.
- datefield, datepicker, daterangepicker, date-i18n and refused-writes tests pass with `--maxWorkers=2`.

## Size

- Estimated M, actual M.
