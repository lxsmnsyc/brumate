---
'brumate': patch
---

In a browser render, markup that reads an async `$memo` whose input never changes now shows the value once the promise settles. Before, the text or attribute stayed empty, because nothing updates such a memo. A rejection of the memo now goes to the nearest `#try`, or to `onError` and the `brumate:error` event.
