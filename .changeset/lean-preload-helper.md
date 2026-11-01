---
'brumate': patch
---

The client build no longer ships Vite's preload helper and its tables of chunk files. A lazy chunk is still held back until its stylesheets have loaded, the scripts of a page come with the `Link` headers of the server, as before, and the imports of a lazy chunk that no header covers (such as the stream chunk of the first server function call) load along with it. The entry chunk of a large app (the website) is 13 kB smaller gzipped, the todos page 0.6 kB. The table of the bundles of the client also leaves out the components that are their own bundle.
