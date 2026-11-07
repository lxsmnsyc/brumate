---
'brumate': minor
---

`event.target` is the control for the events of a form control. In a handler of `input`, `change`, `beforeinput`, `focus`, `blur`, `focusin` and `focusout` on an `input`, a `select` or a `textarea`, `event.target.value` needs no cast. For other events and elements, `event.target` is an `Element`. The new type `ElementEvent<K, E>` of `brumate/elements` gives the type of the event. `<window>` and `<document>` keep `EventTarget`.
