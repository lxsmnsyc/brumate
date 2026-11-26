# Log: examples-glue

- Nothing of the node existed on `chore/examples-glue`.
- hackernews, ui, kit-app, browser-async, tracker: `server.ts`, `node.ts`, `server.prod.ts` and `src/server.ts` deleted; `src/entry-server.ts`, `nitro()` in the config, `dev` is `vite`, `build` is `vite build`, `start` is `node .output/server/index.mjs`. `nitro` 3.0.260903-beta as a dev dependency.
- Early hints work on Nitro's Node preset through `request.runtime.node.res.writeEarlyHints` (checked with curl: a 103 then the page). Static files come with `cache-control: public, max-age=31536000, immutable`.
- `earlyHints` is not in the type of `handle` from `virtual:brumate/routes` (`types.d.ts` says `DocumentOptions`, the runtime takes `RouteOptions`). The entries pass the options as a variable, so no excess property check fires.
- tracker: the plugin prerenders only for `vite build --ssr`; Nitro builds its server as an environment, so `prerender` writes nothing. It is dropped from the tracker config, and `/about` renders on each request. The e2e step that needed the prerendered file and the `shell` mode (stylesheet of a `#defer` body) is removed.
- e2e: `serveNitro` in `e2e/lib.mjs` runs `.output/server/index.mjs` behind a proxy that adds `require-trusted-types-for 'script'; trusted-types brumate`. A nonce policy needs the entry to pass a nonce, so the Nitro suites check Trusted Types only.
- todos: `node.ts` deleted. `server.ts` and `server.prod.ts` use `toNodeHandler` from `srvx/node` (srvx 1.0.6, the version Nitro resolves) and write no script tags. The manifest option left the config, since the plugin turns it on.
- external-scripts and view-transitions (not in the brief) had the tag in their dev `server.ts`; only the `scripts` option was removed there.
- Guard test: `packages/brumate/test/no-hand-scripts.test.ts`. `examples/nitro/test/build.test.ts` asserted `not.toContain('/@vite/client')`; it asserts `'/@vite/'` now.
- benchmarks/brumate/src/server.ts holds no tag (it takes `scripts` as an argument from `adapter.js`, which uses `renderToStream`), so it is unchanged.
