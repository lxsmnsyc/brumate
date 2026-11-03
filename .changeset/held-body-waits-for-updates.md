---
'brumate': patch
---

Fix a block that holds a body of a component the browser renders: it showed the body before the update code of a settled memo had run, so a `<textarea>` or text that reads the memo was empty until the code loaded. The hold now waits for those updates.
