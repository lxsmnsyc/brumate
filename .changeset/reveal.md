---
'brumate': minor
---

`#reveal ('sequential', collapsed) { … }` shows the `#loading` bodies inside it in an order while the page streams: `'sequential'` in the order of the markup, `'backwards'` from the last, `'together'` at once, or `'natural'` as they are ready. `collapsed` shows only the fallback of the next body to show. The data still loads at once, and the server does the ordering, so it needs no code in the browser.
