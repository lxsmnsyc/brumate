# Outcome: ui-form-reset

## Built

- `onFormReset(element, reset, settled?)` in packages/ui/src/fields.ts. It listens for `reset` on the form of an element and returns the cleanup for a `$client`. `reset` and `settled` run together in one `setTimeout` of 0, after the browser reset the fields, and neither runs when the reset event was prevented. Cleanup clears a pending timer. `settled` puts the value of the part back in the native input, which the browser sets to its own default.
- Seven parts reset with it: Checkbox, Switch, CheckboxGroup, RadioGroup, ComboBox, SearchField, TokenField. Each keeps `initial` as a `$signal` of the prop (as Select does) and assigns it back.
  - Checkbox, Switch and Radio get an `id` on their input, and sync it in `settled`. A Checkbox in a group does not write, and the group does.
  - CheckboxGroup, RadioGroup and TokenField find the form from their `ref`. TokenField binds `ref=$bind(ref)` on its root for this.
  - ComboBox resets `selectedKey`, `inputValue`, the list (closed), its filter and its edited state.
  - SearchField syncs the input in `settled`.
- Tests in packages/ui/test/form-reset.test.ts, fixture form-resets.brm: one form of parts with their own state, one form with `$bind(signal, fn)` setters. The first test edits every part, resets, and checks the part, its `data-*` state and its hidden input. The second sets `held`, resets, and checks that the refusing setter keeps the edited value in the part and its input, and in the signals.
- docs/decisions.md and website/ui/state.md ("Form reset", no exceptions listed). Changeset `.changeset/ui-form-reset.md` (patch).

## Decision: the rule

A reset goes through the setter, as Select did. Reasons:

- `$bind(signal, fn)` means the caller decides every write to the state. A reset that goes around it would be the one write the caller cannot refuse.
- The part shows what the caller keeps, which is how every other shape of the state works.
- The maintainer approved a related setter design on 2026-10-28.

## Deviations

- The brief lists no `id` or `ref` changes. Both were needed to find the form without a native input of the part.

## Stubs left

- None.

## Open

- Review round: TextField, NumberField, Select, Slider, the color parts and the date parts now use `onFormReset` too, so a prevented reset changes none of them. Their reset now runs after the browser's, in a timer. Chrome shows no flash with the timer.
- With a setter that refuses, NumberField, ColorField, ColorSlider, ColorArea, ColorWheel, TimeField and DateRangePicker show a value that differs from the one the caller keeps (Chrome): NumberField shows 3 and its inputs say 7, ColorField shows #E2445A while the edit is #0000FF, the thumbs of the color sliders jump back, TimeField shows 2:30 PM while its hidden input keeps 15:32, DateRangePicker shows 10/12/2026 while its hidden input keeps 2026-11-14. Main has the same problem for any refused write. The docs say so. The node `ui-refused-write-sync` fixes them.
- The form is resolved once, when the part loads. A part whose input moves to another form later keeps listening to the first.
- website/ui/state.md: #323 merged first. The merge keeps its structure and demo, and replaces its "Form reset" lists (7 parts that do not reset) with one list of every part, through the setter.
- `settled` is checked in Chrome by the review. happy-dom passes the held test without it. No e2e step was added: the example page of e2e/suites/ui.mjs has no form with these parts, and the test would need a new page.
