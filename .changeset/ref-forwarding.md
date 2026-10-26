---
'brumate': minor
---

`ref` takes `$bind`: `<input ref=$bind(input)>`. The bare form `ref=input` is a compile error. A component forwards a ref by declaring `ref` as a `Bindable` prop and writing `ref=$bind(ref)` on an element, so `<MyButton ref=$bind(el) />` and `<{as} ref=$bind(root)>` give the caller the element, also when `as` names a component.
