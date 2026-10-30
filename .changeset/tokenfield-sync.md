---
'@brumate/ui': patch
---

Fix the box of a TokenField. It shows the kept value again after a `$bind` write is refused and after a form reset, and it writes each token with its own content after quick edits followed by a reset.
