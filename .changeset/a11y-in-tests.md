---
'brumate': minor
---

Add `checkAccessibility(options)` to what `mount` and `visit` return. It runs axe-core on the rendered page and throws with each violation, its element and its fix. Rules about a whole page are off for a mounted component, and the landmark rules are off for a visited page while an element with `inert` or `aria-modal="true"` is in it, and rules that need layout are off. axe-core is an optional peer dependency.
