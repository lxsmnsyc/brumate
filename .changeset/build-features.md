---
'brumate': patch
---

The client build of an app leaves out the code of the core for children that the browser renders, `#template` values that it calls, `<title>` in markup and `$bind` passed to other components, when none of its components use them. The core of the todos benchmark goes from 9.2 kB to 8.3 kB gzip.
