---
'brumate': minor
---

Breaking. A context has no default value. `createContext(key)` takes only a key, and `$getContext(Ctx)` and `$store(Ctx)` throw when no provider above the reader set the context, on the server and in the browser: `The context "key" has no provider above this component. Provide it with $setContext, or in a parent that does`. A default was one object for every request on the server, which made a context a global. `$route()` and `$navigation()` still read on every page. To migrate, delete the second argument of `createContext` and provide the value with `$setContext` in a component above the readers.

Adds `$hasContext(Context)` to `brumate/signals` for a read that may have no provider. It is `true` when a component above provides the context, and fixed when the component renders, on the server and in the browser. `$route()` and `$navigation()` always have a provider. Guard a read with the same context: `const state = $hasContext(Field) ? $store(Field) : undefined`, or `$hasContext(Field) ? $store(group.state) : undefined` for a key of `$getContext(Field)` that is guarded the same way. Without a provider the variable is `undefined`, and nothing links to a store. A `let` in the guarded form, a guard on another context or another shape is the compile error BRM197.
