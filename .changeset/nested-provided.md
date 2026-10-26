---
'brumate': patch
---

- A provided value can hold functions in objects inside it, such as `$setContext(Ctx, { slots: { increment: { onPress } } })`. Before, only the functions at its first level reached the browser, and the others failed to serialize.
- A component can import a name that is its own name, such as `ButtonContext` in `button-context.brm`. Before, the component function hid the import.
