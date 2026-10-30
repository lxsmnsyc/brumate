---
'brumate': patch
---

The client build leaves out the code of the core that no component uses: children that the browser renders, `#template` values that it calls, `<title>` in markup, `$bind` passed to other components, markup that comes after the page (`#loading`, `#defer`, streaming lists and client navigation), `$client` callbacks, handlers of the window or the document, and forms of an `$action`. The core of the todos benchmark goes from 9.2 kB to 8.3 kB gzip. An app that compiles components in the browser sets `features: 'all'` in the plugin options.
