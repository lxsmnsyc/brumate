---
'brumate': minor
---

- `derived(sources, fn, initial?)` of `brumate/store` makes a read-only store from a store or an array of stores, for state at module level. It takes the forms of Svelte 4's `derived`: `fn(values)` returns the value, and `fn(values, set, update)` may return a cleanup. A result equal by `Object.is` does not notify, and a source and a derived store that reads it computes `fn` once per change.
