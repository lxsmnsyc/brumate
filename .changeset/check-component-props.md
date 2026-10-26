---
'brumate': patch
'@brumate/tsc': patch
---

The type check reports a prop that a component does not take, such as `<Badge tone="red" />` when Badge has no `tone`. It also reads the props of every `$props<T>()` call of a component, so a bindable prop from a second call, such as `let { open } = $props<{ open?: Bindable<boolean> }>()`, is known to its callers.
