---
'brumate': patch
---

A prop bound with `$bind(signal, fn)` reads the value that the caller keeps right after a component writes it, in the same turn. Before, the read gave the old value until the caller drew. The setter runs at once when its code has loaded.
