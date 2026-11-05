---
'brumate': minor
---

Add `$store` and `$toStore`, and `brumate/store`. `$store(source)` binds any store, a value with `get`, `subscribe` and optionally `set`, to a variable. The source is a context that holds the store, a key of a `$getContext` value, or a store that the file imports. `let x = $store(source)` writes the store with `set` when the variable is assigned. `$toStore(value)` makes the store of a memo, a signal or a prop in a `$setContext` value. `Store` calls its listeners only when the value changes. The compiler warns when a `$setContext` value reads a signal, a memo or a `let`.
