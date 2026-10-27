---
'brumate': patch
---

A component that a `#template` names only in an attribute value, such as `as=Link`, `icon=Star` or `as=(open ? A : B)`, is imported in the client code of the page. Before, the browser threw a `ReferenceError` when it rendered that template.
