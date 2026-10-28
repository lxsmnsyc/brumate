# Outcome: ui-form-reset

## Built

- `onFormReset(element, reset, settled?)` in packages/ui/src/fields.ts. It listens for `reset` on the form of an element and returns the cleanup for a `$client`. `reset` runs on the event, before the browser resets the fields. `settled` runs after (a `setTimeout` of 0) and puts the value of the part back in the native input, which the browser sets to its own default.
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

- TextField, NumberField, Select, Slider, the color parts and the date parts keep their own copies of the reset listener. They could call `onFormReset`. Not done, to keep the diff to the node.
- They also do not use `settled`. A text input of TextField with a setter that refuses a reset can show the browser's default until the next render. Not tested in a real browser.
- website/ui/state.md: #323 merged first. The merge keeps its structure and demo, and replaces its "Form reset" lists (7 parts that do not reset) with one list of every part, through the setter.
- happy-dom passes the held test without `settled`, so `settled` is checked only by reading, not by a test.
