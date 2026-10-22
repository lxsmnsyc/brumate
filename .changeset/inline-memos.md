---
'brumate': patch
---

The server renders memos and inserts that always give a primitive, such as `$memo(count * 2)` or `{index + 1}`, without a memo object or a check for a promise. Inserted literals, such as `{'<b>'}`, are escaped when the component compiles.
