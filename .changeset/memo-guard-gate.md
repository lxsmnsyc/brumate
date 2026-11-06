---
'brumate': minor
---

`$gate(value, (prev, next) => boolean)` declares a memo that takes its new value only when the guard returns true. Otherwise it keeps its value and its readers do not run. `const query = $gate(input, (_, next) => next.length >= 2)` holds a search until two letters are typed, and `$gate(list.filter(done), (prev, next) => !sameItems(prev, next))` is a memo with its own equality. The first value always passes, and the server renders the value, so the browser guards from it after resume. A guard that throws makes the memo hold the error. A promise or a server function call as the value is the compile error BRM203.
