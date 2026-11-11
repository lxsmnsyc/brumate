---
'@brumate/ui': minor
---

- `MenuTrigger` takes `trigger="contextmenu"`. The menu opens at the pointer on a right click and at a touch held for half a second, and under the focused element on the context menu key or Shift+F10. It is the same `Menu`, with its keys and submenus, and Escape gives focus back.
- `DialogTrigger` takes `shortcut`, such as `Mod+K`, written as the keys of `prevent`. It toggles the overlay from anywhere in the page, and leaves the key to a text field or to a handler that prevented it. `shortcutInInput` opens it from a text field too.
- A recipe for a command palette in the Autocomplete docs.
- `OverlayTriggerState` has `point`, and `followTrigger` of `position.ts` takes an `Anchor`, with `pointAnchor(x, y)`, so a Popover opens at a point.
