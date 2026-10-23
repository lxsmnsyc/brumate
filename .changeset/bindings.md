---
'brumate': minor
---

Components can write their props, and parents can bind them.

- `let { open = false } = $props()` declares props that the component writes. Without a binding, the component writes its own copy, and a new value from the parent replaces it.
- `$bind(name)` from `brumate/signals`, as the value of a prop, passes a signal or a `let` prop to a child. The child's writes change it, through any number of levels.
- `value=$bind(draft)` and `checked=$bind(done)` on an input, a select or a textarea write the signal as the user types, without loading code of the component.
- `$bind(name, fn)` calls `fn(next)` for each write in place of writing the name, so the parent can refuse a value or change it.
- A rest prop keeps its bindings, and a spread on an element binds `value` and `checked` from them.
- `Bindable<T>` marks a prop that a parent can bind. `$props<T>()` gives it as `T`. `brumate-tsc` reports a binding of a prop that is not `Bindable`, and the compiler warns about a `Bindable` prop that the component reads only with `const`.
