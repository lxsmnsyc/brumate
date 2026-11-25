---
'brumate': patch
---

- `prerender` writes pages in a Nitro build. Pages with `#defer` blocks become server assets that `handle` sends as the `shell`, and the other pages are files in the client output. A shell's script tags get the request's nonce.
- A build of several environments writes `.brumate/hints.json` and `build.json` to the client output, and the server and the client share one build ID, so skew protection compares the same ID.
