---
'brumate': minor
---

- `handle` of `virtual:brumate/routes` sends the client scripts when you pass no `scripts`. A `scripts` you pass, including `''`, still wins.
- The dev server gets the Vite client and the client entry of the app (the first non-HTML `input` of the client build), or the start module when the app has none. A production build gets the tag of the same entry from the client manifest.
- The default tags carry the `nonce` option of the render.
- The dev scripts follow `base`.
- A server build that uses the routes fails when the client build is missing. Build the client first.
- The new `clientOutDir` option names the output directory of the client build. A client built to a directory other than `dist/client` (or the client environment's output) needs it, or the server build fails.
- The client build writes `.vite/manifest.json` unless `build.manifest` is set.
