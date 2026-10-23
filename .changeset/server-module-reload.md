---
'brumate': patch
---

On the dev server, a change to a module that only the server reads, such as data or Markdown that a page renders, now reloads the page. Before, the page kept showing the old content until a manual reload.
