---
'brumate': patch
---

A memo that throws on the server renders the `#catch` of the nearest `#try` that reads it, also when the memo is declared outside the `#try`. The server waits for the memo where it is declared, keeps the error, and the markup reads it in place. An awaited memo, `const foo = await $memo(bar())`, still throws at its declaration.
