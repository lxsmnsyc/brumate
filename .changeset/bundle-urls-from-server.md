---
'brumate': patch
---

The client entry of a build no longer holds a table of every bundle of the app. The server names the bundles that a page needs in the `b-load` attribute of its state records, for the first load, for client navigation and for `#defer` bodies, and the loader imports those URLs. The entry no longer grows with the app: the entry of the website drops from 13.3 kB to 3.7 kB (gzip). A page also links to the stylesheets that the modules of its bundles import, in its head.
