---
'brumate': patch
---

The scopes of a `#loading` body get IDs after the ID of their boundary, such as `5.0`, so the IDs of a page no longer depend on the order in which its `#loading` data arrives. `$id()` inside a `#loading` body gives an ID such as `b5_0-0`, which also works as a CSS selector. The page format changed, so the server and the client must come from the same version.
