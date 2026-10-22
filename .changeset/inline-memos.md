---
'brumate': patch
---

The server renders memos, signals and inserts that always give a primitive, such as `$memo(count * 2)`, `let count = $signal(0)` with `count++`, or `{index + 1}`, without a memo object or a check for a promise. Inserted literals, such as `{'<b>'}`, are escaped when the component compiles.
