---
'brumate': patch
---

The scopes inside `#if`, `#switch`, `#for`, `#repeat`, `#try` and `#offscreen` get IDs after an ID of their block, such as `4.0`, so the markup after a block keeps its IDs whatever the block rendered. A `#defer` body then loads on a page whose markup before it depends on the user, such as a prerendered page. The page format changed, so the server and the client must come from the same version.
