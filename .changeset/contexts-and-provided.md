---
'brumate': patch
---

- A provided value can hold functions in objects and lists inside it, such as `$setContext(Ctx, { slots: { increment: { onPress } } })` or `{ items: [{ run }] }`.
- A component can import a name that is its own name, such as `ButtonContext` in `button-context.brm`.
- A component that reads a context and provides the same context again updates when the value above it changes, and so do the components that read its value. `$getContext` always reads from the scopes above the reader.
- A module function that returns one local under two keys, such as `{ up, cancel: up }`, is a compile error that says so.
