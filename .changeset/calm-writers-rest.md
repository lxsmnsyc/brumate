---
'brumate': patch
---

An effect in a child that calls a writer of a context no longer runs again on its own write. The context stays live: markup, memos and other effects that call a reading function of it still update. Before, the effect ran without end and the tab hung.
