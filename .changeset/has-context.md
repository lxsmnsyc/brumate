---
'brumate': minor
---

Adds `$hasContext(Context)` to `brumate/signals`. It is `true` when a component above provides the context, and fixed when the component renders, on the server and in the browser. `$route()` and `$navigation()` always have a provider. A read of a context that may be missing is guarded with the same context: `const state = $hasContext(Field) ? $store(Field) : undefined`, or `$hasContext(Field) ? $store(group.state) : undefined` for a key of `$getContext(Field)` that is guarded the same way. Without a provider the variable is `undefined`, and nothing links to a store. A `let` in the guarded form, a guard on another context or another shape is the compile error BRM197.
