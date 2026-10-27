---
'brumate': patch
---

A memo that throws, or whose promise rejects, holds the error in the browser, and each read of it throws into the nearest `#try` around the reader. Before, the error went to the `#try` around the memo, and a rejected memo kept its old value. An error of an update no longer stops the rest of the write; only the limit of 10000 rounds does. A `#try` that reads a memo now ships its `#catch` body to the browser.
