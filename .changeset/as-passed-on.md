---
'brumate': patch
---

The live props of a part's dynamic tag reach a component that a page gives to the part in `as` when the part passes it on to another part (`<Button {as}>`), and when the page writes `as=(flag ? A : B)`. Before, the component kept the props of the server render.
