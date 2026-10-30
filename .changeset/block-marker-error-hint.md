---
'brumate': patch
---

The "Missing end marker" error of the browser render names its usual cause: an element such as `<p>` that closes early around a block, such as a `<div>`, so the block's markers end in different parents.
