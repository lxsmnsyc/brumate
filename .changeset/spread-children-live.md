---
'brumate': patch
---

Markup that the browser reads after a change, such as a `#loading` body that streams in or a second page, keeps the children and the component in `as` that the server rendered. With a spread onto a component, its children and `as` can change, and this update replaced them, with their focus. The page state now names the insert where the server rendered each children, so children that the server did not render at an insert still render there.
