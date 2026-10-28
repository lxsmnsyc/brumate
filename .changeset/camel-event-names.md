---
'brumate': minor
'@brumate/ui': patch
---

A handler of an event with more than one word is written in camel case only. `onKeydown` and `onFocusout` on an element, `<window>` or `<document>` are now a compile error at the attribute, and the message names the camel form (`onKeyDown`, `onFocusOut`). Events of one word, such as `onClick`, are unchanged.

Breaking: the `attrs` object of `createForm` has `onFocusOut` in place of `onFocusout`. A form that spreads `attrs` needs no change. Code that reads `attrs.onFocusout` must read `attrs.onFocusOut`.

An app that merges its own event into `ElementEvents` gives the camel name in `ElementEventNames`: `interface ElementEventNames { itemaction: 'ItemAction' }` makes `onItemAction` its attribute. `@brumate/ui` does this for `itemaction` and `toastchange`.
