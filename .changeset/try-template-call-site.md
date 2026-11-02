---
'brumate': patch
---

A `#try` now catches the client errors of a `#template` by where the template is called. Before, two cases went past the `#catch` to `onError` and `brumate:error`: a template called both inside and outside the `#try`, and a template declared above the scope that holds the `#try`, such as a top-level template called in a `#try` inside a `#for`. The scope of a template now links to the scope where its output is inserted, and errors go on from there.
