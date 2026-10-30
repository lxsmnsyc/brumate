---
'brumate': minor
---

`ref` takes `$bind`: `<input ref=$bind(input)>`, also on a dynamic tag, `<{as} ref=$bind(panel)>`.

Breaking: the bare form `ref=input` is a compile error. A `ref=$bind(x)` whose signal holds another element than the tag is a type error.

- A component forwards a ref by declaring `ref` as a `Bindable` prop and writing `ref=$bind(ref)` on an element, so `<MyButton ref=$bind(el) />` and `<{as} ref=$bind(root)>` give the caller the element, also when `as` names a component.
- A component that leaves `ref` in its rest props and spreads them onto an element or a dynamic tag gives the element to the parent's signal, on the server, in markup that the browser renders, and when the rest or `as` changes.
- A `ref` bound with a setter, `ref=$bind(root, fn)`, calls `fn` with the element in the browser.
- A signal that only the `ref` of a component binds may hold an element.
