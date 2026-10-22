---
'brumate': minor
---

A `<title>` in `#head` sets the title of the page. The last one in the page wins, so a title in an `#if` needs no code in a script, and the title changes as blocks add and remove them. A `<title>` elsewhere in the markup is an error, except in an `<svg>` or a `<head>` element. `$title` still works, with a warning that points to `<title>`, and goes in a later version.
