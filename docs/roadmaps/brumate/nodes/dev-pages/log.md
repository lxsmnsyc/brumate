# Log: dev-pages

- Read briefs and the default-scripts outcome. No earlier work found.
- Added the Node bridge (`toWebRequest`, `sendWebResponse`), `servePage` and `pagesMiddleware` to `packages/brumate/src/vite.ts`. `configureServer` returns the post hook.
- `config` hook sets `appType: 'custom'` for serve (not preview) when unset.
- Tests in `packages/brumate/test/dev-pages/dev-pages.test.ts` run a real dev server on port 0. 10 pass.
