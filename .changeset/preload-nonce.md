---
'brumate': patch
---

Under a policy with a nonce, the `modulepreload` links of a page carry the nonce, and the page has no `Link` header, which cannot carry one. Before, a strict policy blocked them.
