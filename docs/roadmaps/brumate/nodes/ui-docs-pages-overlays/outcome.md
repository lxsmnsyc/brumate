# Outcome: ui-docs-pages-overlays

## Built

The overlay group, seven of the twenty pages of the node: Dialog, Popover, Modal, Sheet, Tooltip, PreviewTrigger and Toast. The node stays `active` for the other thirteen.

The PR stops here because each page needs an anatomy picture, a styled example, two use cases and a state demo, which is 35 new demo files. The seven pages share one behavior to check (focus, inert page, Escape), so they are one review. The other thirteen are layout and display parts (Disclosure, Breadcrumbs, Meter and the rest), which do not need the several inert layers of an overlay picture.

| Page           | Anatomy               | Use cases                                                                     | Styled                   | Controlled and uncontrolled                                                             |
| -------------- | --------------------- | ----------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Dialog         | DialogAnatomy         | a confirmation (alertdialog in a Modal), a rename form in a Popover           | DialogStyled             | DialogStateDemo: a `DialogTrigger` with own state, `$bind`, `$bind` with a setter       |
| Popover        | PopoverAnatomy        | where it opens (four placements), a filter with a CheckboxGroup               | PopoverStyled            | PopoverStateDemo: the same three shapes, with non-modal popovers                        |
| Modal          | ModalAnatomy          | unsaved changes (nested Modal, `isKeyboardDismissDisabled`), opened from code | ModalStyled              | ModalStateDemo: held by the trigger, `$bind`, `$bind` with a setter that refuses Escape |
| Sheet          | SheetAnatomy          | a menu of pages, a panel of filters with Apply and Cancel                     | SheetStyled (four edges) | SheetStateDemo, as Modal                                                                |
| Tooltip        | TooltipAnatomy        | icon buttons in a Toolbar, one Button with a tooltip and a popover            | TooltipStyled            | TooltipStateDemo: own, `$bind`, `$bind` with a setter                                   |
| PreviewTrigger | PreviewTriggerAnatomy | names in a text, a Button that previews and presses                           | PreviewTriggerStyled     | PreviewTriggerStateDemo, as Tooltip                                                     |
| Toast          | ToastAnatomy          | undo for a removed note, toasts that stay and a limit                         | ToastStyled              | skipped: a toast has no state prop. The page says that the queue holds the toasts.      |

- The anatomy pictures draw each layer in place as a block of its own (trigger, overlay, box, dialog), with the visible sentence of the checklist. The Dialog, Modal and Sheet pictures use several inert layers. The Select-sized `max-width` is not used. Badges that a clipped or rotated piece would hide sit on a wrapper (the Modal box, the arrows), and the Dialog badge uses `data-mark-side="inside"` so that it does not meet the badge of the Popover.
- Every claim was read against packages/ui/src and clicked through in Chrome (see below). Only form fields reset (state.md), so each state section says an overlay does not, and that the server renders the trigger and no overlay.
- Each styled example has rest, hover, press, keyboard focus as two bands, open (`aria-expanded`), disabled where it applies, and the closed look of the overlay. Colors use `light-dark()`. Every class has a prefix of its own (`dialog-styled-`, `popover-styled-`, `modal-styled-`, `sheet-styled-`, `tooltip-styled-`, `preview-styled-`, `toast-styled-`). No change to website/src/routes/ui/_layout.brm.
- Two e2e flows in e2e/suites/website.mjs: a static one for the seven pages in both schemes (CSS shows, callouts equal the listed pieces, axe finds nothing), and one that uses the pages: it opens each overlay, submits the rename form (the name changes, the URL does not), checks where Escape puts focus, and closes a nested modal.

## Checked in Chrome

- Dialog, Popover: focus moves into the dialog once the popover has entered. Tab wraps at its ends. Escape closes it and focus goes back to the trigger. A press outside closes it. Two quick clicks on the trigger leave it closed. A request that the `$bind` setter refuses leaves it closed. The non-modal popovers close when focus leaves them.
- Confirmation: Escape and "Keep it" give focus back to the Delete button that opened the Modal. After "Delete" the row is gone and focus goes to the page. The page says so.
- Rename form (its own file, `onSubmit=(prevent(submit))`): a valid name saves, the popover closes, focus returns to Rename, and the page does not reload. Calling `event.preventDefault()` inside the handler does not work, since the listener is passive: the browser then sent the form and reloaded the page. An empty name is blocked by the browser, and Cancel throws the draft away.
- Modal: the page is inert and `overflow: hidden` while it is open. A nested Modal opens over the first, and Escape closes only the top one. With `isKeyboardDismissDisabled` bound to a dirty form, Escape and a press on the overlay leave it open. A `$bind` setter that refuses a close keeps it open on Escape, and a direct write closes it.
- Sheet: all four edges place and slide, a press outside closes it, a button with `slot="close"` runs its own `onPress` and focus returns to the trigger, and Cancel keeps the filters while Apply changes them.
- Tooltip: shows after `delay` on hover and at once on focus from the keyboard, Escape hides it, the Button gets `aria-describedby`, arrow keys in a Toolbar move the tooltip, and a Button can be a `DialogTrigger` trigger and a `TooltipTrigger` trigger at once.
- PreviewTrigger: the second name shows its card without the delay. A mouse press on a Button trigger runs `onPress`, and the card fades out and returns (bug e).
- Toast: Undo restores the note at its place and closes the toast, F6 moves focus to the newest toast, and a queue limited to two shows two and one more when a toast closes.

## Part bugs, as the review confirmed them on main

Each is its own fix, from main. None is fixed here.

- (a) A start value of `true` does not open an overlay: `isOpen=(true)`, or a `$signal(true)` bound to a Modal, a ModalOverlay, a DialogTrigger or a TooltipTrigger. Cause: an effect never runs when the page loads (website/docs/effects.md), and the overlays open from an `$effect` on their open value, which a start value never changes. The pages, the JSDoc of DialogTrigger, TooltipTrigger, PreviewTrigger and MenuTrigger, and website/ui/menu.md now say so, and the demos do not start open.
- (b) Compiler: a function used twice, once in children that render later, is `undefined` in the browser. Minimal repro: a component that renders `{children}` in an `#if` after a click, and a page with `function bump()`, `<button onClick=bump>` and `<Wrap><button onClick=bump>go</button></Wrap>`. Pressing the toggle gives `bump$ is not defined`. With one use it works, and a plain `#if` with no component works. The same error shows with two uses in nested children, and in a `#template` given to a ToastRegion that uses a function the page also uses. `save$ is not defined` in the rename form was this bug. The demos write such handlers inline, or move the form into its own file.
- (c) Closing a Modal and the Modal over it in one step leaves focus on the page, but only when the overlay has a CSS transition. Without one, focus goes to the button that opened the first. A single Modal closed with Escape returns focus in both cases.
- (d) After a `$bind` setter refuses a tooltip, a hover back within `closeDelay` is not asked again, and neither is a focus: `show()` in tooltip.ts returns early when `current?.id === id`, and the refused tooltip still counts as current.
- (e) A press of a PreviewTrigger with the mouse does not keep the preview hidden. After a hover, the card fades out, then comes back within about 370 ms, since the pointer is still on the trigger. `onPress` runs, and a press with the keyboard hides it. The page says exactly this.

A setter on a Modal or Sheet with its own `isOpen` sees only close requests. That is not a bug: only `close()` writes `isOpen`, and your own write to the signal is not a request.

## Deviations

- The brief lists twenty pages. Thirteen are left (below).
- A Modal and a Sheet with their own `isOpen` have no start-open shape (bug a), so the state demos show the held, written and refused shapes.
- Screenshots: Dialog, Popover, Toast and Tooltip, anatomy and styled, in both themes, and the open styled blocks. The other pages' anatomy pictures in both themes were looked at too.

## Stubs left

- The thirteen pages: disclosure, disclosure-group, breadcrumbs, toolbar, meter, progress-bar, group, separator, heading, transition, visually-hidden, keyboard, i18n-provider.

## Notes for the next pages

- A part with `overflow` clips its own badge (the Modal box): put `data-mark` on a wrapper.
- An element with `position: fixed` in a class (the toast region) needs `style="position: relative"` in the picture, or the badge goes to the top of the figure and is clipped.
- Two badges at the top right corner of nested boxes meet. Use `data-mark-side="inside"` for the inner one.
