---
'brumate': minor
---

Add `checkAccessibility(options)` to what `mount` and `visit` return. It runs axe-core on the rendered page and throws with each violation, its element and its fix. Rules about a whole page are off for a mounted component and while a modal makes the page inert, and rules that need layout are off. axe-core is an optional peer dependency.
