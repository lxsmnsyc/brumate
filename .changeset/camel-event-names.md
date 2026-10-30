---
'brumate': minor
---

Breaking: a handler of an event with more than one word is written in camel case only. `onKeydown` and `onFocusout` on an element, `<window>` or `<document>` are a compile error, and the message names the camel form (`onKeyDown`, `onFocusOut`). Events of one word, such as `onClick`, are unchanged.

- The `attrs` object of `createForm` has `onFocusOut` in place of `onFocusout`. A form that spreads `attrs` needs no change.
- An app that merges its own event of several words into `ElementEvents` also adds an entry to `ElementEventNames`: `interface ElementEventNames { itemaction: 'ItemAction' }` makes `onItemAction` its attribute.
