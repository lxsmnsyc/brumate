---
'brumate': patch
---

A memo that no code reads does not run in the browser, as on the server. The browser render leaves out its declaration and its compute, and so does a memo that only such a memo reads. A memo with a side effect in its compute, such as a server function call, no longer runs there. A memo that only an `await` reads still runs and still reports its rejection to the nearest `#try`; `$$b.unreadMemo` stays for that case.
