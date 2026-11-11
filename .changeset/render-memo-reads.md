---
'brumate': patch
---

The browser render wraps fewer memos. A memo that cannot throw, or that the markup always reads, no longer goes through `renderMemo` and its reads need no check. A memo that only a function, a handler or a block reads keeps the held error, which each read throws to the nearest `#try`.
