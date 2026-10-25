---
'brumate': patch
---

A template at an insert updates in place only when it is the same template that the server rendered there, and only until the browser writes the insert. Before, a template shown again after other content stayed on that content, and a switch between two templates of one component kept the first.
