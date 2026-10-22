---
'brumate': patch
---

A page with no pending `#loading` body sends a smaller state script, and renders faster on the server. The script assigns only the values that it uses more than once.
