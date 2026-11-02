---
'brumate': patch
---

In a browser render, text and attributes that read an async `$memo` whose input never changes now show the value once the promise settles. Before, they stayed empty, because nothing updates such a memo. A rejection of the memo now goes to the nearest `#try`, or to `onError` and the `brumate:error` event. Markup that the browser renders as HTML instead of a cloned template still does not wait for the memo.
