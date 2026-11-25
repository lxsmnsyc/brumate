# Outcome: examples-glue

## Built

Per example:

- hackernews, ui, kit-app, browser-async, tracker: `server.ts`, `node.ts`, `server.prod.ts` and `src/server.ts` are deleted. Each has `src/entry-server.ts` (server function calls with `handleCall`, then `handle(request, options)`, 404 when nothing matches), `nitro()` after `brumate()` in `vite.config.ts`, the client input under `environments.client`, `nitro/vite/types` in `tsconfig.json`, and `nitro` 3.0.260903-beta as a dev dependency. Scripts: `dev` is `vite`, `build` is `vite build`, `start` is `node .output/server/index.mjs`. No script tag is written anywhere.
- todos: the documented own-server case. `node.ts` is deleted. `server.ts` (`middlewareMode`) and `server.prod.ts` use `toNodeHandler` from `srvx/node`, `srvx` 1.0.6 (the version Nitro resolves) is a dependency, neither passes `scripts`, and `vite.config.ts` no longer sets `build.manifest` (the plugin turns it on). The build stays `vite build --outDir dist/client && vite build --ssr src/server.ts --outDir dist/server`. README text updated.
- external-scripts, view-transitions (not in the brief): the dev `server.ts` and `server.prod.ts` no longer pass `scripts` or read the manifest. Their `vite.config.ts` and the one of trace drop `manifest: true` and its comment (the plugin turns it on). Their e2e suites still use `serveBuild`, which passes its own nonce tag.
- `benchmarks/navigation`: `serve.mjs` has a Nitro mode (`serveServer(root, { nitro: true })` runs `node .output/server/index.mjs`, no gzip), and `run.mjs` marks the tracker app as Nitro, checks `.output` for a missing build, and builds it with `NODE_ENV=production`. A dry start of `serveServer` answered 200 on `/`; the bench itself was not run.
- `e2e/README.md` describes the Nitro suites, Trusted Types only. `script-nonce` restores the nonce checks and `nitro-prerender` restores the tracker prerender and the removed step. `serveNitro` fails fast when Nitro drops a stream and forwards 103 early hints.
- `website/scripts/dev.ts`: no `scripts` option.
- `benchmarks/brumate/src/server.ts`: unchanged. It has no tag: it takes `scripts` from `benchmarks/brumate/adapter.js` and uses `renderToStream`, which has no default.
- Guard test `packages/brumate/test/no-hand-scripts.test.ts`: fails on `@vite/client` in `examples`, `website/docs`, `benchmarks` and `website/scripts`, except `benchmarks/brumate-0.3` and the two known occurrences in `website/docs/getting-started.md` (the server example and the bullet under it; `KNOWN` counts them, so a third fails). A second test fails on a `<script type="module"` tag or a `.vite/manifest.json` read in the code of `examples` (tests excluded). `examples/nitro/test/build.test.ts` asserted `not.toContain('/@vite/client')`; it asserts `'/@vite/'`.
- e2e: new `serveNitro(root)` in `e2e/lib.mjs` runs `node .output/server/index.mjs` behind a proxy that adds `require-trusted-types-for 'script'; trusted-types brumate` to each HTML answer. The `tracker`, `kit`, `ui` and `browser-async` suites use it, and their builds run with `NODE_ENV=production`. `todos`, `scripts`, `transitions` and `trace` keep `serveBuild` (their servers are own servers, and `trace` reads spans in process).

## Features Nitro kept and lost

- Early hints: kept. The entries pass `earlyHints` that calls `request.runtime.node.res.writeEarlyHints` (Node preset only; other presets send none). Checked with curl: a `103` with the `Link` values, then the page.
- Static files and cache headers: kept. Nitro serves `.output/public` with `cache-control: public, max-age=31536000, immutable` on `/assets/*`, and an etag.
- Page cache (`cache` in routes, `cached`): kept, it is in the routes runtime.
- tracker prerendering: lost. The plugin prerenders only in `vite build --ssr`, and Nitro builds its server as an environment, so `prerender` writes nothing under Nitro. The option left the tracker config, `/about`, `/team`, `/from` and `/titles` render on each request, and the README and `about.brm` say so. The `shell` option (a prerendered page that streams `#defer` bodies) is not used by any example now. The e2e step "the #defer body waits for its own stylesheet" needed that mode and was removed; the other steps pass on rendered pages. A follow-up could make prerender work with Nitro's environments.
- e2e nonce policy on the four Nitro suites: lost. The default script tag has no nonce, so a `script-src 'nonce-…'` policy cannot hold; they check Trusted Types only. The `todos`, `scripts`, `transitions` and `trace` suites keep the nonce policy.

## Deviations

- Edited outside the owned paths: `examples/external-scripts`, `examples/view-transitions` and `examples/trace` (servers and configs, see above), `examples/nitro/test/build.test.ts` (it had the tag), and `benchmarks/navigation/{run,serve}.mjs` (the tracker pair needs the Nitro build).
- `earlyHints` is missing from the type of `handle` in `packages/brumate/types.d.ts` (`DocumentOptions`; the runtime takes `RouteOptions`). The entries pass the options as a variable, so no excess property check fires. Not edited (not owned).
- The brief says `benchmarks/brumate/src/server.ts` drops hand-written tags; it has none.
- `tsconfig.json` of the five examples adds `nitro/vite/types`, as `examples/nitro` has it.

## Gotchas

- For client-scripts-docs: `website/docs/getting-started.md` still has the hand-written tag twice (the server example and the bullet). Remove both and empty `KNOWN` in the guard test. `deploying.md` still links todos' deleted `node.ts`, and `README.md` and `routing.md` describe tracker's prerendered page (nitro-prerender). The Prerendering section of `deploying.md` still describes the `--ssr` build; it does not apply under Nitro.
- toNodeHandler's type is a union of handlers; `as RequestListener` makes it callable from `node:http`.
- The root `pnpm typecheck` is killed (SIGKILL) under load when examples run in parallel; `pnpm -r --workspace-concurrency=1 typecheck` passes.
- Examples read `brumate` from `packages/brumate/dist`: rebuild it first.

## Verification

- `pnpm lint`: warnings only. `pnpm format:check`: pass. Typecheck of every package, one at a time: pass.
- Example tests (`pnpm --filter "./examples/*" test`): all pass.
- `node e2e/run.mjs --only kit,ui,browser-async`: 5, 61, 6 passed. `--only tracker,todos,scripts,transitions,trace,nitro`: 17, 10, 7, 7, 6, 2 passed.
- Guard test: 1 passed.
- `pnpm bench --only brumate --scenario todos`: pass; first counter click 0 requests after idle and cold. It uses `benchmarks/brumate`, which this node did not change, so it is a no-regression check.
- Root `pnpm test`: pass (126 files, 3635 tests in brumate, examples and other packages pass). Full `node e2e/run.mjs`: all ten suites pass.

## Size

- Estimated L, actual L.
- Risk estimated medium, measured medium: five apps change their production host, and the e2e proxy drops the nonce check for four suites.
