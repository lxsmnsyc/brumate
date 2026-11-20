---
'brumate': patch
---

A page with `onTrace` no longer loads a link's page early on hover or focus, since that request cannot carry `traceparent`. Each navigation requests its page with `traceparent`, so the server span joins the trace of the navigation.
