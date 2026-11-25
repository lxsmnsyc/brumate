---
'brumate': patch
---

- The default script tags of `handle` carry the `nonce` option of the render, in dev and in a build. Without a nonce they have none.
- A prerendered shell that `handle` reads from Nitro's server assets gets the nonce on its script tags.
- The `handle` options of `virtual:brumate/routes` are typed as `RouteOptions`.
