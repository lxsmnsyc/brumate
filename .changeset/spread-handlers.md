---
'brumate': minor
---

A handler that a component passes on with a spread, such as `onClick` in `{...rest}`, now reaches the element, with its wrappers of `brumate/events`, and runs in the component that passed it. An update of a spread in the browser removes the attributes that the new value drops.
