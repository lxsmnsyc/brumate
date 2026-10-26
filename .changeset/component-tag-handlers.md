---
'brumate': patch
---

A component in a dynamic tag keeps the handlers of its caller when the browser renders it. Before, `<AsButton as=Wrap>` in a block that opens in the browser lost the caller's handler, because the component's own `b-on` replaced it, and the entries of the tag had no scope.
