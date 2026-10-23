---
'brumate': minor
---

`handle(request, { shell })` takes the HTML that the build prerendered for the path. The server sends it at once, then renders the `#defer` blocks with the `load` or `idle` trigger and streams their bodies in the same response, so the browser makes no request for each. A server that serves prerendered files passes the file as `shell` instead of sending it.
