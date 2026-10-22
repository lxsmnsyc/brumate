---
'brumate': minor
---

Pages hint the modules that every page loads, the loader and the core: `<link rel="modulepreload">` in the head, and `Link` headers that hosts can turn into `103 Early Hints`. `earlyHints` in the options of `route` receives the links before the page renders, for a server that sends `103` itself, such as with Node's `writeEarlyHints`. The client build writes the URLs to `.brumate/hints.json`.
