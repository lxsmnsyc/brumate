# Outcome: bundle-urls-from-server

## Built

- `packages/brumate/src/runtime/server.ts`: `RenderOptions.bundles` (`ClientBundles`: `chunks`, root ID to chunk URL; `members`, root ID to the IDs of its components; `loaded`, roots the browser has). Each state record with scopes gets `b-load="<url> <url>"`: the bundles of its components that the render has not named yet. A root names its own bundle; another component names the first bundle that holds it, unless a bundle named in this render holds it. A `#defer` render starts with the bundles of the views as `loaded`, so its body names none that the page has. `renderPage` links to the stylesheets of the bundles of the views in the head, on every page and navigation.
- `packages/brumate/src/runtime/bundles.ts`, export `brumate/bundles`: `loadBundle(url)` imports a chunk once (resolved against `document.baseURI`) and keeps its `modules`; `load(id)` reads every `script[b-load]` of the page, then waits for the pending bundles. An entry that imports only `load`, as `website/src/client.ts` does, works without `loadBundle`.
- `packages/brumate/src/vite.ts`: the build manifest is `export { load, loadBundle } from 'brumate/bundles'` plus `loadBundle.all = () => import('virtual:brumate/bundles')`. That virtual module imports every bundle and never loads; it only makes the build keep a chunk for each bundle, with the chunk graph that the old table gave. `hints.json` gains `chunks` and `members`, and `bundles[root]` lists the stylesheets of a bundle too. Dev keeps its `modules` table.
- `packages/brumate/src/routes.ts`: the routes module passes `bundles`, made once at module level.
- `packages/brumate/src/runtime/boot.ts`: the loader reads `script[b-load]` at start instead of a regex over the state. `runtime/client/resume.ts` no longer calls `loadBundle`; `CoreOptions.loadBundle` is gone.
- Tests: `test/bundle-urls.test.ts` (client and server build of an app with a layout, two pages, a shared component, a `#defer` body, a `#client` body and a stylesheet; dev server), two tests in `test/resume.test.ts`. `test/preload-helper.test.ts` adjusted.
- Changeset `.changeset/bundle-urls-from-server.md` (patch).

## Deviations

- The brief asked for an ID-to-URL map. The records hold only URLs: a bundle registers its own component IDs, so `load(id)` needs no map.
- Stylesheets that a module of a bundle imports came in through Vite's table on the `import()` of the old entry. The server now links to them in the head. Only those of the bundles of the views are linked; a stylesheet of a bundle that a later record names (not a view's) is not.
- A new package export, `brumate/bundles`, and an alias in each test config that lists the runtime.

## Stubs left

- None.

## Gotchas

- A bundle emitted as an entry chunk (`emitFile`) made the preload helper a chunk of its own, since a bundle imports the core and the core imports the helper. Hence the unloaded `virtual:brumate/bundles` chunk.
- An entry that imports only `load` drops unused exports of the manifest. The `loadBundle.all` write is what keeps the bundles chunk.
- Residual risk from the brief: a component that the client renders first and that is in no bundle the page named. Bundles are closures over `.brm` imports, and the server names the bundle of every component scope, so this needs a component reached by no `.brm` import of the page. It then has no client code.
- A custom server that calls `render()` itself and wants code in the browser must pass `bundles` (from `hints.json`).
- `docs/architecture.md` (loader step) still says the loader reads the bundles of the components in the state; not an owned path.

## Proposed learnings

- To keep a chunk per lazy module without a table in the entry, import them from a chunk that nothing loads | an emitted entry changes how shared modules split | packages/brumate/src/vite.ts | yes (bundle-urls.test.ts)

## Verification

- `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1,934 passed).
- `node e2e/run.mjs --only todos,tracker,website`: todos 9/9, tracker 14/14, website 72/72. A website run during a parallel build failed 2 steps (a navigation page error with no message, a tooltip Escape); the rerun passed 72/72, and next passed 72/72.
- Chrome probe on the website build: `/` to `/docs` to `/` by navigation, no errors, each page's records name its bundles.

## Size

Gzip. Bench (`pnpm bench --only brumate`) on origin/next 05463ad7 against the branch:

|                                     |                next |            branch |
| ----------------------------------- | ------------------: | ----------------: |
| todos, JS before `load`             |   13.5 kB (5 files) | 13.4 kB (5 files) |
| todos, client JS in dist            |             27.2 kB |           27.2 kB |
| todos, SSR HTML 3 todos             |               713 B |             712 B |
| dashboard, JS before `load`         |             23.4 kB |           22.8 kB |
| dashboard, client JS in dist        |             37.0 kB |           36.6 kB |
| dashboard, SSR HTML                 |              6.0 kB |            6.0 kB |
| website entry (`client-*.js`, zlib) | 44,781 B / 13,301 B | 8,948 B / 3,691 B |

The website entry loses 9.6 kB gzip on every page. `hints.json` of the website holds 63 kB of `members` for the server build.

- Estimated L, actual L.
