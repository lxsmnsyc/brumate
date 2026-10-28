# Outcome: overlay-start-open

## Built

An overlay with an open start value opens on load, in every part that has one: Popover (with DialogTrigger, MenuTrigger, or its own `isOpen`), Modal, ModalOverlay and Sheet (the same, with a trigger or their own `isOpen`), Tooltip (TooltipTrigger) and the preview card (PreviewTrigger).

- The fix is a `$client(..., 'load')` in Popover, ModalOverlay and Tooltip. It calls `change(true)` when the value is already open and the layer is not mounted, the same call the effect makes after a change. The triggers and the parts built on these three needed no change.
- PreviewTrigger starts `followPreview` from the same kind of callback, so a preview that started open closes on pointer or focus leaving, as one opened by hover does. The first run of its effect stops that one before it starts its own.
- Decision (docs/decisions.md): open on load from the client, not on the server. A popover needs the rect of its trigger, and a modal needs focus, the inert page and the scroll lock set by code, so a server-rendered open layer would still need the same code and could not be placed.
- Docs: dialog, popover, modal, sheet, tooltip, preview-trigger, menu and combo-box pages, and the JSDoc of DialogTrigger, TooltipTrigger, PreviewTrigger, MenuTrigger and the `isOpen` prop of ComboBox (that line only; combobox-fixes edits the rest of the file).
- Changeset: patch for @brumate/ui.

## Tests

packages/ui/test/start-open.test.ts, with the fixture test/fixtures/start-open.brm. 19 tests. The first 15 failed on main before the fix and pass now. The last 4 came with the review round and also fail without it: Sheet, Select and ComboBox start open, two modals that start open stack, and a non-modal popover leaves focus in a field being typed in.

- Popover (own `isOpen` and with DialogTrigger), Modal, Modal with own `isOpen`, ModalOverlay with own `isOpen` and Menu: open after load, focus inside, page inert, scroll locked, `aria-expanded` on the trigger. Popover and Modal have focus on the dialog.
- Escape closes a modal that started open and gives focus back to the trigger. A tooltip shows and describes its trigger. A preview shows, a press of the trigger hides it, and it closes when the pointer leaves.
- Two modals that start open: the later is on top, the earlier is inert, Escape closes the top one first, then the other.

## Review round

- Two modals that start open: the loads ran together, and each modal's inert marked the other. The loads now run one after another through `queueLoad` in overlay.ts, in document order. The loaded effect made a second `show` of each overlay on the first write of the bound value, which was the same bug a second time, so `change(true)` now does nothing for an overlay that is shown or opening (`shown`). `keepFocus` leaves focus alone while its layer is inert, since an overlay above it made it so.
- Focus: a modal, sheet or menu that starts open takes focus even from a field the reader focused (documented). A non-modal popover leaves it in a field being typed in.
- Popover, ModalOverlay and Tooltip give back what they hold when they leave the page before any change. PreviewTrigger stops its follow on unmount.

## Checked in Chrome

playwright-core with findChrome, scratch routes in examples/ui on port 5421 (removed after). Every part was open after load with no page error. Popover, modal, overlay and menu: focus inside (dialog, or the first menu item), the page inert, `overflow: hidden`. Popover placed at its trigger (266, 64), Tab stays inside, a press outside closes it and writes the signal. Modal: Escape closes it, the page is no longer inert, focus returns to the trigger. Tooltip: shown, `aria-describedby` on the trigger, page not inert. Preview: shown, page not inert, closes when the pointer leaves.

## Size

No change in packages/brumate, so the todos size is unchanged. @brumate/ui adds a small `$client` call to three parts and a few lines to PreviewTrigger; client code of a part loads with the page's code for that part, not into the core.

## Not done

- The server renders no open layer, so the first paint has none. That follows from the decision above.
- ComboBox renders its list in a Popover, so the same path should open it. That was not tested here. combobox-fixes owns ComboBox, and the combo-box page now says only that `isOpen` works as the other states do.
