---
'brumate': patch
---

An element with a `class` that changes and a spread with a `class`, such as `<p class=(active) {...rest}>`, keeps the class of the spread when its own class changes in the browser. Before, the update of its own class replaced both.
