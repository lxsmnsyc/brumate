---
'brumate': patch
---

An update in the browser that replaces the markup of an insert now destroys the scopes of the removed nodes. A component rendered in the browser with a `#for` that calls a `#template` of the same file made new scopes at each update and never freed them, so the page leaked memory and their cleanups never ran.
