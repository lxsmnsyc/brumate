# Outcome: render-bundles-default

## Built

- `packages/brumate/src/runtime/server.ts`: `setClientBundles(bundles)`, exported from `brumate/server`. `render()` and `#defer` renders use `options.bundles ?? clientBundles`, so an explicit option wins.
- `packages/brumate/src/vite.ts`: `virtual:brumate/client-bundles` calls `setClientBundles()` with the bundles of the client build (in memory after a client build in the same process, else `hints.json`). In a build, the server version of each component imports it, and so does the routes module. A server build that finds no `hints.json` warns. Dev adds nothing.
- `packages/brumate/src/routes.ts`: `routeModule` no longer embeds the table of bundles; the default covers it.
- Tests in `test/bundle-urls.test.ts`: a server entry that calls `renderToStream()` with no `bundles`, built in the process of the client and in a fresh plugin (as `vite build` twice); an explicit `bundles` wins; dev names none.
- `website/docs/reference-server.md`: the `bundles` option and the default rule.
- Changesets: `.changeset/render-names-client-bundles.md` (minor, new export); the last sentence of `.changeset/bundle-urls-from-server.md` now says no option is needed.

## Deviations

- Option 1 only. The case it misses, a server built before its client, gets a build warning, not a render error, since the routes module has the same gap and a render cannot tell it from an app with no client code.

## Stubs left

- None.

## Gotchas

- The import goes in the server version of each component, not in an entry, because a custom server can have any entry, and every render needs a component module.
- The bench adapter still reads `hints.json` and passes `bundles`. It can drop that now.

## Proposed learnings

- To give a runtime module a build-time default, import a virtual module from the code that every use of it needs | packages/brumate/src/vite.ts | yes (bundle-urls.test.ts)

## Verification

- `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1,954 passed; 3 devtools tests failed under load and pass alone).
- `node e2e/run.mjs --only todos,nitro,kit`: 9/9, 2/2, 5/5.
- `pnpm bench --only brumate --scenario todos`: click checks pass, 13.5 kB before `load`.

## Size

- todos, JS before `load`: 13.5 kB (5 files), as on next.

- Estimated S, actual S.
