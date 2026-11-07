---
'brumate': minor
---

`$isPending` takes several memos. `$isPending(a, b)` is true while any of them loads, and a read of each memo it names counts as guarded for BRM182 in a handler. BRM108 now reads "$isPending needs async $memos as its arguments".
