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
- One e2e flow in e2e/suites/website.mjs covers the seven pages in both schemes: the CSS shows, the callouts equal the listed pieces, and axe finds nothing.

## Checked in Chrome

- Dialog, Popover: focus moves into the dialog once the popover has entered. Tab wraps at its ends. Escape closes it and focus goes back to the trigger. A press outside closes it. Two quick clicks on the trigger leave it closed. A request that the `$bind` setter refuses leaves it closed. The non-modal popovers close when focus leaves them.
- Confirmation: Escape and "Keep it" give focus back to the Delete button that opened the Modal. After "Delete" the row is gone and focus goes to the page. The page says so.
- Rename form: an empty name does not send the form, a valid one saves and closes, Cancel throws the draft away.
- Modal: the page is inert and `overflow: hidden` while it is open. A nested Modal opens over the first, and Escape closes only the top one. With `isKeyboardDismissDisabled` bound to a dirty form, Escape and a press on the overlay leave it open. A `$bind` setter that refuses a close keeps it open on Escape, and a direct write closes it.
- Sheet: all four edges place and slide, a press outside closes it, a button with `slot="close"` runs its own `onPress` and focus returns to the trigger, and Cancel keeps the filters while Apply changes them.
- Tooltip: shows after `delay` on hover and at once on focus from the keyboard, Escape hides it, the Button gets `aria-describedby`, arrow keys in a Toolbar move the tooltip, and a Button can be a `DialogTrigger` trigger and a `TooltipTrigger` trigger at once.
- PreviewTrigger: the second name shows its card without the delay, a press on a Button trigger runs `onPress` and hides the preview.
- Toast: Undo restores the note at its place and closes the toast, F6 moves focus to the newest toast, and a queue limited to two shows two and one more when a toast closes.

## Part bugs found in Chrome, not fixed here

- A start value of `true` does not open an overlay. `isOpen=(true)` on a Modal and a TooltipTrigger, and a `$signal(true)` bound to a ModalOverlay, showed nothing after load. Nothing ran for the overlay until an event reached the page. The existing text of the pages said it starts open. The pages now say it does not, and the demos do not start open.
- Compiler: a function, or an import such as `prevent`, that only the children of a component or a `#template` use is `undefined` in the browser when the overlay renders them (`save$ is not defined`, `prevent is not defined`, `Dialog is not defined` for a top-level `#template` that holds a component). The demos write the handler inline with a block body, and call `event.preventDefault()` in the `onSubmit` of the rename form. A fix belongs in its own node.
- Closing a Modal and the Modal over it in one step (Discard in the unsaved-changes demo) leaves focus on the page, not on the button that opened the first one.
- After a `$bind` setter refuses a tooltip, a hover that comes back within `closeDelay` is not asked again, since the timing keeps the tooltip as shown. It asks again once the pointer has been away for `closeDelay`.

## Deviations

- The brief lists twenty pages. Thirteen are left (below).
- A Modal and a Sheet with their own `isOpen` have no `$bind` shape that "starts open", so the state demos show the held, written and refused shapes.
- Screenshots: Dialog, Popover, Toast and Tooltip, anatomy and styled, in both themes, and the open styled blocks. The other pages' anatomy pictures in both themes were looked at too.

## Stubs left

- The thirteen pages: disclosure, disclosure-group, breadcrumbs, toolbar, meter, progress-bar, group, separator, heading, transition, visually-hidden, keyboard, i18n-provider.

## Notes for the next pages

- A part with `overflow` clips its own badge (the Modal box): put `data-mark` on a wrapper.
- An element with `position: fixed` in a class (the toast region) needs `style="position: relative"` in the picture, or the badge goes to the top of the figure and is clipped.
- Two badges at the top right corner of nested boxes meet. Use `data-mark-side="inside"` for the inner one.
