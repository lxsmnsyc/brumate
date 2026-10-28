# Outcome: pending-submit

## Built

A pending submit Button keeps `type="submit"` and cancels the submit of its form. A click and Enter in a field no longer send the form again.

## Design

- Option A: the fix is in Button only. A pending reset Button still becomes `type="button"`, because a kept reset type would reset the form.
- A `$client(…, 'idle')` callback adds one `submit` listener on the window, in the capture phase, and removes it when the Button leaves the page. brumate delegates form handlers on the document in the capture phase, so a listener on the form would run after the handler of the form. The window runs first.
- The listener cancels the event (preventDefault and stopImmediatePropagation) only when the Button has `data-pending`, the event target is its form, and the submitter is the Button. A submit with no submitter, such as `form.requestSubmit()`, is cancelled when the Button is the first submit button of the form. A Button that is not pending does nothing, so the other submit listeners of the page run.
- It reads `data-pending` from the element, because a signal read in a `$client` callback is the value at load.
- Enter in a field makes the browser click the default button, the first submit button in tree order. That click gives a submit with that button as the submitter, so the same check covers it.
- Two submit buttons in one form: only a pending button is blocked. A click on the other button sends the form. Enter sends it unless the first button is the pending one. This is in button.md.
- Space and Enter on a submit button are as before. A pending submit button keeps Space to the browser, and the cancelled submit stops the send.
- A signal write that adds a `prevent` modifier at run time does not work: the document listener for `click` is registered passive when no button prevents at load, and a changed `b-on` is not scanned again. This is why the click is not prevented on the Button. It may be worth a core node.

## Checked in Chrome

playwright-core with the Chrome of the harness, on examples/ui in dev with a scratch route (not committed): a form with one text field and a Save Button that is pending for 1500 ms after each submit.

- Click: 1 submit, the button gets `data-pending` and `aria-disabled`, `type` stays `submit`.
- During pending: Enter in the field, a forced click on the button, and Enter on the button gave no submit. Focus stayed on the button.
- After pending ended: Enter in the field gave 1 submit. Space and Enter on the focused button each gave 1 submit when not pending.
- The two-submit-button case was covered by a test, not by Chrome.

## Tests

packages/ui/test/Button.test.ts, with the fixture test/fixtures/pendingSubmit.brm: one text field, a click and Enter during pending give no second submit, Enter submits when pending ends; two submit buttons; the page's own submit listeners run and the Button's listener is removed on unmount. happy-dom has no implicit submission, so the test clicks the default button as the browser does.

## Docs

button.md says the pending button prevents a second submit, and explains the two-button case. ButtonSaveDemo drops its `if (saving) return` guard.
