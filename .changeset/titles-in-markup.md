---
'brumate': minor
---

A `<title>` in markup, also in `#head`, but not in a `<head>` element or an `<svg>`, sets the title of the page. The last one in the page wins, so a title in an `#if` needs no code in a script, and the title changes as blocks add and remove them. `$title` still works, with a warning that points to `<title>`, and goes in a later version.
