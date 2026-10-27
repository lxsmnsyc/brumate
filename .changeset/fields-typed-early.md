---
'brumate': patch
---

The core reads the fields that the user changed before the code loaded. When it starts, it writes the signal of each text field, textarea, select and box with a `value` or `checked` binding whose value differs from the one the server rendered, as an `input` event would. A field the user did not change is not read.
