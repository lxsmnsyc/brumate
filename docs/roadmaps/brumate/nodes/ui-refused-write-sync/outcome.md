# Outcome: ui-refused-write-sync

## Cause

Seven parts keep a display value apart from the bound value: the text of NumberField and ColorField, the `working` color of ColorField, ColorSlider, ColorArea and ColorWheel, the `parts` of TimeField, and the `startValue` and `endValue` of DateRangePicker. A write set the display first, then wrote the bound value. When the setter refused, the bound value did not change, so the effect that follows the value did not run, and the display kept the refused value. A reset did the same with the first value. The parts that were already in sync (Slider, DateField) derive their display from the value.

The native range inputs had a second gap: a user move of the input set its own `value`, and nothing wrote it back when the part kept the old value. This also affected Slider.

## Built

- Each write reads the value back after the write. If it is not what was written, the display goes back to the kept value and `onChange` does not run:
  - NumberField: `setValue` formats `value`, not `next`.
  - ColorField, ColorSlider, ColorArea, ColorWheel: `working` returns to its old color (full precision kept), or to the new value when the setter changed it. ColorField also sets its text.
  - TimeField: `parts` come from `value` after a refused write and after a reset.
  - DateRangePicker: the fields come from `value` after a refused range and after a reset.
- SliderThumb writes the kept value back into the range input after an input event. ColorThumb does it in a `setTimeout` of 0, because the context of a ColorPicker has not drawn the new value yet at the event.
- Checkbox and Switch write the kept state back into their input after a change. This also fixes a Switch whose setter accepts later: the input matches the shown value during the delay. Radio puts the checked radio back to the choice the group keeps. The check of a radio group and a checkbox group was stale until a reset.
- Test: packages/ui/test/refused-writes.test.ts and fixtures/refused-writes.brm. One form of the seven parts with refusing setters (typing, thumbs, arrow keys, PageUp, reset), one form with groups, radios, a Checkbox and a delayed Switch. All three tests fail on main and pass now.
- docs/decisions.md and website/ui/state.md: the "not yet in sync" list is gone. Changeset `.changeset/ui-refused-write-sync.md` (patch).

## Deviations

- Change handlers follow one rule in every part with a bound value: the handler gets the value the caller keeps, and only when it differs from the value before the write (docs/decisions.md, website/ui/state.md). A setter that rounds or uppercases gets the handler with the changed value; a setter that refuses gets none. A part that writes its own state reads the kept value at once. With a `$bind(signal, fn)` setter the part sees what the caller keeps only after the caller drew, so `afterWrite` in packages/ui/src/fields.ts waits one timer and then compares. Tests: packages/ui/test/change-handlers.test.ts.
- The notes in website/ui/checkbox.md, switch.md, checkbox-group.md and radio-group.md that said a refused click was not put back are removed.

## Stubs left

- None.

## Checked in Chrome

A scratch page of the fixture in examples/ui (not committed), real keys, typing and mouse drags. After accepted edits, a hold, refused edits (typing, arrows, PageUp/PageDown, drags of the slider, area and wheel, clicks on the groups, the box) and a form reset, every part, its `data-*` and its inputs matched the kept value. A Switch whose setter accepts after 300 ms had its input and its shown value agree during the delay and after it.

## Open

- Size: no scenario of the harness measures @brumate/ui. The change adds about 6 lines to each of seven parts, and 1 to 3 to five more.
