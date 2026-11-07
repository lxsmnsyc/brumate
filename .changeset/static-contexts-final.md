---
'brumate': minor
---

Breaking. Every context is static: a `$setContext` value is read once, and a reader keeps it. The compiler no longer updates a context when a name in its value changes, and the runtime has no `updateContext`. A value that changes goes in a store: `$toStore` in the provider, `$store` in the reader. `$route()` and `$navigation()` still update their readers.

A `$setContext` value that reads a signal, a memo, a prop or a `$bind` value that changes in the browser, outside a function, is now the compile error BRM196. It was a warning, and only for a local signal, memo or `let`. A read inside a function, `$untrack` and `$toStore` are allowed. A handler that a reader gets from a context keeps the scope of its provider, so it still works after that scope goes. To migrate, replace `$setContext(Ctx, { value })` with `$setContext(Ctx, { value: $toStore(value) })` and read it with `const given = $getContext(Ctx); const value = $store(given.value);`.
