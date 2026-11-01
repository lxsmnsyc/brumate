---
'brumate': patch
---

A prop write to a child whose code fails to load now reaches the nearest `#catch`. Before, the rejection was unhandled, no `#try` caught it and the `#catch` never rendered.
