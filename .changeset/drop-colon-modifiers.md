---
'brumate': minor
---

Event modifiers in the attribute name are removed. `onSubmit:prevent=save` is a compile error (BRM022) on elements, `<window>`, `<document>` and components, and the error names the wrapper of `brumate/events` to write: `onSubmit=(prevent(save))`. For `:passive`, write a plain handler, since listeners are passive unless a handler prevents. BRM023 is gone, since BRM022 covers components.
