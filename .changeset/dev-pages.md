---
'brumate': minor
---

- `vite dev` serves the pages of `src/routes`, so an app needs no `server.ts` in development.
- The plugin sets `appType: 'custom'` for the dev server when the config leaves it unset.
- The pages are not served with `server.middlewareMode` or with Nitro. With `appType: 'spa'` or `'mpa'` they are not served either, and a warning says why.
