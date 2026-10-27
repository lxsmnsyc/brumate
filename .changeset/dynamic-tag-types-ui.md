---
'@brumate/ui': minor
---

The handlers of the parts type `event.currentTarget` in place of casting it. Public types that change: `ColorThumbState.onPress` takes `PointerEvent & { currentTarget: Element }`, `isAnchor` is a type guard (`element is HTMLAnchorElement`), `aria-disabled` and `aria-invalid` of Group take `string | number | boolean | null` in place of `unknown`, `aria-label` of Dialog takes a string, and `ElementEvents` has the `itemaction` event that ListBox and GridList send to their items.
