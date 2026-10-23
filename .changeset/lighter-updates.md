---
'brumate': patch
---

Lists update with less work in the browser. Rows that the client renders no longer run their updates again after they go into the page, a list whose items all change removes the old ones at once, and the loader does not watch new rows whose code has loaded.
