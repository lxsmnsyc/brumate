---
'brumate': minor
---

Components can write their props, and parents can bind them.

- `let { open = false } = $props()` declares props that the component writes. Without a binding, the component writes its own copy, and a new value from the parent replaces it.
- `$bind(name)` from `brumate/signals`, as the value of a prop, passes a signal or a `let` prop to a child. The child's writes change it, through any number of levels.
- `value=$bind(draft)` and `checked=$bind(done)` on an input, a select or a textarea write the signal as the user types, without loading code of the component.
- `Bindable<T>` marks a prop that a parent can bind. `$props<T>()` gives it as `T`.
