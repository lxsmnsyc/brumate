---
'brumate': patch
---

A memo that throws, or whose promise rejects, holds the error in the browser, and each read of it throws into the nearest `#try` around the reader. Before, the error went to the `#try` around the memo and stopped the rest of the write, and a rejected memo kept its old value. A `#try` that only reads a memo now ships its `#catch` body to the browser.
