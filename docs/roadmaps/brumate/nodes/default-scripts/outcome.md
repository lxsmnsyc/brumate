# Outcome: default-scripts

## Built

- `packages/brumate/src/routes.ts` exports `START_MODULE`, `START_URL`, `devScripts()` and `entryScript(base, file)`. `routeModule` takes a last `scripts` argument and the generated `handle` uses `options?.scripts ?? <default>`, so an explicit `scripts`, including `''`, wins.
- `packages/brumate/src/vite.ts`: `defaultScripts()` picks the dev pair when `isServe`, else the client entry from the manifest. The choice is made when the routes module is generated, not at runtime. The preview page uses `devScripts()`, so the preview and the default share `START_URL`.
- Production: `readEntry()` reads `.vite/manifest.json` from `clientDirectory()` (`prerender.client`, else the client environment's `outDir` when it differs from the server output, else `dist/client`). A missing or invalid manifest or a manifest with no entry is `this.error` with "Build the client first". A set `BRUMATE_BUILD` that differs from the client's build ID warns.
- The client build sets `build.manifest: true` when the project leaves it unset.
- New plugin option `clientOutDir` (relative to the root). The client directory is looked up as: `clientOutDir`, then `prerender.client`, then the client environment's `outDir` when it differs from the server's, then `dist/client`. The build ID, hints, manifest and prerender all read from it. The missing-manifest error says to build the client first or set `clientOutDir`.
- The build ID check: when the server's build ID differs from the one in the client output, the build warns ("... for skew protection").
- The dev scripts follow `base` (`/app/@vite/client`, `/app/@id/__x00__virtual:brumate/start`).
- The manifest is turned on for the client environment only. The entry is read once per resolved config: `buildStart` keeps it while the config that wrote the client hints is in use, so several server environments (Nitro sets `builder.sharedConfigBuild`) share one read.
- When the plugin turned the manifest on and the client and servers build in one process, `closeBundle` deletes the manifest after the last server environment of the config closed. A per-app `buildApp` hook did not work: Nitro's own `buildApp` is also `order: 'post'` and runs after ours. Nitro's `.output/public` has no `.vite/manifest.json` afterwards. The manifest file name follows `build.manifest` when it is a string.
- The dev base prefix uses the pathname of a base that is a URL.
- One helper, `isServerModule`, decides server modules for both the routes and the server registry (load `ssr` or consumer `server`).
- Nitro's server environment loads the routes with `ssr` unset, so a route module is a server module when `this.environment.config.consumer === 'server'` too.
- `packages/brumate/src/prerender.ts` builds its tag with `entryScript`.
- Tests: `packages/brumate/test/default-scripts/default-scripts.test.ts` (dev, build, explicit `''`, missing client build).
- Changeset: `.changeset/default-scripts.md` (minor).

## Deviations

- The manifest is read when the routes module loads in a build, not in `buildStart`. Nitro's client environment runs `buildStart` before its output exists, and a server build with no routes should not fail.
- The error appears only for a server build that loads `virtual:brumate/routes`.
- `build.manifest` is turned on by default for the client build (needed to read the entry).
- Edits outside the owned paths are the shared files the brief lists: `vite.ts`, `routes.ts`, `prerender.ts`, one changeset.
- Nitro: `examples/nitro` `pnpm build` (against a rebuilt `packages/brumate/dist`) bakes `<script type="module" async src="/assets/client-*.js">` into the routes module. Nitro itself does not write a manifest, so `.output/public/.vite/manifest.json` is new with this node, and it is removed after the server build.

## Gotchas

- Round 3: each client build starts a round. Its `generateBundle` clears the entry and the started and closed server sets. The first server of a round reads the entry in `buildStart`, so a later server does not need the manifest. The manifest goes when every server that started this round has closed, so a configured server that never builds does not hold it.
- Round 3 test: a watch rebuild is simulated with the same builder building client and ssr twice (same resolved config), with `edge` configured and never built. Vite does not rebuild servers when only the client source changes in a test, so the real `--watch` is not run.
- Known limit: a manifest name given only on the client CLI is not seen by the server build. Put it in the config.
- Known limit: a client built in parallel with the servers is not supported. The client must build first.
- `START_URL` needs an explicit type annotation (isolatedDeclarations).
- Server builds that use `virtual:brumate/routes` now need a client build first. Any other test or example that builds the server alone will fail with the new error.
- Machine load makes `resume`, `differential-*`, `search-params` time out; they pass alone. `test/styles/style-files-postcss.test.ts` and `style-files.test.ts` were real failures (client built to `<name>/client`); they now set `clientOutDir`.
- Examples read `brumate` from `packages/brumate/dist`: rebuild it before testing Nitro.
- For client-scripts-docs: document `clientOutDir` in the plugin reference (reference-plugin). Not documented here.
- Any project that builds the client to a custom directory must set `clientOutDir` (or `prerender.client`) for the server build.

## Verification

- `pnpm --filter brumate exec vitest run test/default-scripts`: 4 passed.
- `pnpm exec oxlint`: no errors, warnings only. `pnpm exec oxfmt --check`: pass. `pnpm --filter brumate typecheck`: pass. Root `pnpm typecheck` was killed (SIGKILL) in `examples/ui` for memory, not run to the end.
- Full `vitest run` in packages/brumate: 126 failures. Most were timeouts under load, but `style-files-postcss` was a real failure (fixed in the review commit). `resume.test.ts` (669 passed) and `differential-2` rerun alone pass. Website and tsc tests not run (no docs or types changed).

## Size

- Estimated M, actual M.
- Risk estimated medium, measured medium: `manifest: true` default and the build error change every server build that uses the routes.

- Review fixes: lint, format:check, `pnpm --filter brumate typecheck` pass. `test/default-scripts`, `test/styles`, `vite.test`, `prerender`, `skew`, `bundle-urls` pass (one watcher timing failure in style-files-postcss passed alone).
- Round 2: root `pnpm typecheck`, lint, format:check pass. default-scripts (8 tests, including two server environments with a Nitro-like builder), styles, vite.test, prerender, skew, bundle-urls, routes, routes.test, testing: 189 passed. `examples/nitro` `pnpm build` bakes the tag and leaves no manifest. `node e2e/run.mjs --only nitro`: 2 passed.
- Round 3: lint, format:check, root typecheck pass. test/default-scripts (9), styles, vite.test pass (one watcher timing failure in style-files-postcss passed alone). `examples/nitro` build leaves no manifest, `node e2e/run.mjs --only nitro` 2 passed.
