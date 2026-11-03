---
'brumate': patch
---

The client of a build is smaller:

- It drops five more runtime paths when no component uses them: `#try`, the fields of an element `$bind`, windowed lists, dynamic tags and `$route` or `$navigation`. The Vite plugin sets a flag for each from the compiled components, as it does for the other features. The client of a page like the todos example is about 1 kB smaller (gzip). A build with `features: 'all'` is unchanged.
- The code-part loading that lazy loading left is gone. A handler or an update no longer waits for a part of its module, and a build no longer emits the `w` export. Effects now also wait for writes that wait for code, so an effect such as the check of Tabs never sees a half updated page.
