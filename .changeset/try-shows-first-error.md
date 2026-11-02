---
'brumate': patch
---

A `#try` shows the first error of its body when two arrive at the same time, such as two effects that throw in one update, as the server does. It rendered its `#catch` once per error, and the last error stayed.
