---
'brumate': patch
'@brumate/ui': patch
---

A prop bound with `$bind(signal, fn)` now reads the value that the caller keeps right after a component writes it, in the same turn. Before, the read gave the old value until the caller drew. The setter runs at once when its code has loaded. In `@brumate/ui`, `onChange` and `onSelectionChange` now get the value that is kept, and run only when it differs from the value before the write. A setter that rounds gives the rounded value, and a setter that refuses gives no call. The box of a `TokenField` shows the kept segments after a refused edit.
