---
'brumate': patch
---

The client build of an app also leaves out the code for markup that comes after the page (`#loading`, `#defer`, lists that stream and client navigation), for `$client` callbacks and `#defer` blocks, for handlers of the window or the document, and for forms of an `$action`, when none of its components use them. An app that compiles components in the browser sets `features: 'all'` in the plugin options.
