# Log: date-field-sync

- Read the brief. All four items reproduced on main with a new test file (4 of 5 tests failed before the fix).
- Bug 1: `dateSegments` gets `reset(kept)`. DateField calls it after a write that the setter changed, and after a form reset. DateRangePicker already read back.
- Bug 2: arguments of a `.brm.ts` call stay reactive only when they are names. DateField and DateRangePicker now pass `$memo(locale.locale)` and `$memo(strings?.placeholders)`.
- Bug 3: `formField` takes an optional message and sets it as custom validity on the hidden input (effect, plus once at load). DateField and DateRangePicker (start input) pass the range message.
- Item 4: `data-hovered` on CalendarCell and DateSegment, `data-focus-visible` on DateSegment, set from the handlers like `data-pressed`.
- Tests are flaky under load when other agents run: the first event of a part loads its code. The test retries clicks with idempotent buttons.
