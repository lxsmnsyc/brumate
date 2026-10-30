# Log

- ColorField and NumberField cleared `nativeErrors` only on reset. Added `recheck()` as in ComboBox (a timeout, since the input shows the new text after the update), called on input and after the blur commit.
- Select clears on select, Date/Time fields clear in `formField.changed`; TextField and ComboBox already re-check. No change there.
- Tests: test/field-error-clears.test.ts with fixture test/fixtures/field-errors.brm. Both failed on main source before the fix.
