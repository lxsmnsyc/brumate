---
'brumate': patch
---

Drop five more runtime paths from the client of a build that never uses them: `#try`, the fields of an element `$bind`, windowed lists, dynamic tags and `$route` or `$navigation`. The Vite plugin sets a flag for each from the compiled components, as it does for the other features. The client of a page like the todos example is about 1 kB smaller (gzip). A build with `features: 'all'` is unchanged.
