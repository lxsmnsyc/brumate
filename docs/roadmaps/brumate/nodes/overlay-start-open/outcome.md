# Outcome: overlay-start-open

## Built

An overlay with an open start value opens on load, in every part that has one: Popover (with DialogTrigger, MenuTrigger, or its own `isOpen`), Modal, ModalOverlay and Sheet (the same, with a trigger or their own `isOpen`), Tooltip (TooltipTrigger) and the preview card (PreviewTrigger).

- The fix is a `$client(..., 'load')` in Popover, ModalOverlay and Tooltip. It calls `change(true)` when the value is already open and the layer is not mounted, the same call the effect makes after a change. The triggers and the parts built on these three needed no change.
- PreviewTrigger starts `followPreview` from the same kind of callback, so a preview that started open closes on pointer or focus leaving, as one opened by hover does. The first run of its effect stops that one before it starts its own.
- Decision (docs/decisions.md): open on load from the client, not on the server. A popover needs the rect of its trigger, and a modal needs focus, the inert page and the scroll lock set by code, so a server-rendered open layer would still need the same code and could not be placed.
- Docs: dialog, popover, modal, sheet, tooltip, preview-trigger, menu and combo-box pages, and the JSDoc of DialogTrigger, TooltipTrigger, PreviewTrigger, MenuTrigger and the `isOpen` prop of ComboBox (that line only; combobox-fixes edits the rest of the file).
- Changeset: patch for @brumate/ui.

## Tests

packages/ui/test/start-open.test.ts, with the fixture test/fixtures/start-open.brm. Written first: all 9 failed on main. Now 10 pass. Each of popover, popover with own `isOpen`, modal, modal with own `isOpen`, overlay with own `isOpen` and menu has: open after load, focus in the dialog or menu, the page inert, scroll locked, `aria-expanded` set with a trigger. Also: Escape closes a modal that started open and gives focus back to the trigger, a tooltip shows and describes its trigger, a preview shows and a press of the trigger hides it, and a preview closes when the pointer leaves for the page.

## Checked in Chrome

playwright-core with findChrome, scratch routes in examples/ui on port 5421 (removed after). Every part was open after load with no page error. Popover, modal, overlay and menu: focus inside (dialog, or the first menu item), the page inert, `overflow: hidden`. Popover placed at its trigger (266, 64), Tab stays inside, a press outside closes it and writes the signal. Modal: Escape closes it, the page is no longer inert, focus returns to the trigger. Tooltip: shown, `aria-describedby` on the trigger, page not inert. Preview: shown, page not inert, closes when the pointer leaves.

## Size

No change in packages/brumate, so the todos size is unchanged. @brumate/ui adds a small `$client` call to three parts and a few lines to PreviewTrigger; client code of a part loads with the page's code for that part, not into the core.

## Not done

- The server renders no open layer, so the first paint has none. That follows from the decision above.
- ComboBox renders its list in a Popover, so the same path should open it. That was not tested here. combobox-fixes owns ComboBox, and the combo-box page now says only that `isOpen` works as the other states do.
