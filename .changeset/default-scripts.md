---
'brumate': minor
---

- `handle` of `virtual:brumate/routes` sends client scripts when you pass no `scripts`.
- The dev server gets `/@vite/client` and the start module.
- A production build gets the entry of the client build.
- A server build that uses the routes fails when the client build is missing.
- The client build writes `.vite/manifest.json` unless `build.manifest` is set.
- The new `clientOutDir` option names the output directory of the client build.
- The dev scripts follow `base`.
- A `scripts` you pass, including `''`, still wins.
