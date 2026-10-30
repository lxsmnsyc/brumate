---
'brumate': patch
'@brumate/ui': patch
---

A `prevent` that is written after load now cancels a delegated `click` or `submit`, which the document no longer listens to passively. A part can cancel a delegated event of its element before any handler by adding a function to the set `bCancels` of the element. A pending submit Button uses it and no longer adds a listener to the window.
