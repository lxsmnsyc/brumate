---
'brumate': patch
---

An element that the browser renders outside the render function of its component, such as one in `{children}` or in a row the browser adds to a `#for`, gets `b-v` with the scope ID. It had `b-v="[object Object]"`, so it kept its first style variables.
