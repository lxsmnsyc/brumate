---
'brumate': minor
---

A markup spread can hold the props object or the rest as a branch of `?:`, `&&`, `||` or `??`, such as `<div {...(open ? rest : {})}>`. The other branch is an object literal, `undefined`, `null` or `false`. When the branch is on, a `ref` in the rest reaches the element. When it is off, the rest is not on the element and the `ref` is cleared: a signal is set to `undefined`, and a setter of `$bind(name, fn)` is called with `undefined`, then with the element when the branch turns on again. A call, a nested condition or another object in the other branch is still BRM115.
