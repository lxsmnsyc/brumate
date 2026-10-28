# Outcome: combobox-fixes

## Built

Four fixes in three parts, and the JSDoc and docs that went with them. One test per bug in packages/ui/test/combobox-fixes.test.ts. All four fail on main and pass here.

- (a) Server error after a pick. Cause: `edited` was a boolean that a pick set and only a reset cleared, so `validationErrors` never showed again. Fix in ComboBox.brm and Select.brm: `edited` keeps the `validationErrors` object that was current at the pick, as TextField does. Errors from a later reply are a new object, so they show. A reset clears it.
- (b) Message of `isRequired` in ComboBox. Cause: the Input got no `onInvalid` from the ComboBox, so the browser bubble showed and the FieldError stayed empty. Fix: the ComboBox gives the Input `onInvalid`, keeps the message in `nativeErrors`, shows it in the FieldError and `data-invalid`, and moves focus to the input when it is the first invalid field. The message goes once the field has text (typing or a pick). A reset clears it.
- (c) Picked text after a refused `selectedKey`. Cause: `select` wrote the picked text to `inputValue` before the key write, and never read back what the setter kept. Fix: `select` writes the key first, reads the kept key, and shows the text of that item. If the kept key is `null`, the typed text stays and blur clears it as before. `onSelectionChange` still reports the request (rule of #332). Tab needs no change, since `selectedText` now holds the kept text.
- (d) Autocomplete filter after a code write. Cause: `filterText` was its own signal that only typing set. Fix: `filterText` is a memo of `inputValue`, so any write changes the filter. With a refusing setter the items keep filtering by the kept text.
- JSDoc of `isOpen` in ComboBox and MenuTrigger, and the same line in select.md and menu.md: "Alone it holds its own state, which starts closed".
- Docs: the notes on these bugs are gone from combo-box.md, select.md and autocomplete.md. The changeset is a patch.

## Checked in Chrome

A scratch page in examples/ui (not committed) on port 5420, driven with playwright-core and findChrome.

- (a) Pick a fruit and a size, then a reply sets `validationErrors`: both FieldErrors show, both parts get `data-invalid`.
- (b) `requestSubmit` on a form with an empty required ComboBox: the FieldError reads "Please fill out this field.", `data-invalid` is set, and focus is on the input.
- (c) With a setter that refuses, pick Banana: `onSelectionChange` gets `banana`, the key stays `apple`, the input shows "Apple", and still shows it after Tab.
- (d) A button writes `ban` to a bound `inputValue`: Apple is hidden and Banana shows.
- No page errors.

## Checks

tsdown in packages/brumate, tsc in packages/brumate, tsdown of language-core and tsc, oxfmt --check, oxlint (warnings only, none new), brumate-tsc in packages/ui, ui suite with `--maxWorkers=1` (65 files, 604 passed, 1 expected fail), website check:samples (63 samples, 0 problems) and website build.

## Notes

- A refused typed `selectedKey = null` (empty text) is not changed here.
- A Autocomplete with a refusing setter and a field that shows other text calls the setter again on each click, since the field text differs from the kept text.
