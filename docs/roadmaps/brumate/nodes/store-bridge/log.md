# Log: store-bridge

## Steps

1. Read the brief, the `$store` entry of decisions.md and the outcomes of store-any-source and context-read-fallback.
2. Measured the base client JS (f4e951f6, `npx vite build --outDir dist/client`, `gzip -9c` summed over every `.js`): examples/todos 106,192 B raw, 39,479 B gzip; examples/ui 676,665 B raw, 202,813 B gzip.
3. Runtime (`runtime/store.ts`): `bridge()`, the `Bridged` class, `nameBridge`, `isBridged`, `setBridgeLoader`. `sameData` moved here from `client/context.ts`, so a late subscriber can use it.
4. Page state: `BridgePlugin` in `serial.ts` (data from `get` and the bridge name), `stateValues.g` in `shared.ts`, `BridgeDataError` and `bridgeDataError` in `server.ts` for the error that names the store and the context or prop.
5. Compile time: `bridges.ts` finds the calls and the exported names; BRM200 in the analyzer (a component), in `nameBridges` (Vite transform) and in `brumate check` (`checkScripts`). The Vite plugin appends `nameBridge(local, "bridge:<file>#<export>")` to a script with a bridge, and the manifest gets a loader for each such file (`bridge:<file>`), in dev and in build.
6. Feature flag `bridges` (`__BRUMATE_HAS_BRIDGES__`), on when the app has a script with a bridge, so apps without one keep the old core.
7. Tests, docs, skill reference, decisions.md, changeset.

## Decisions

- Where the bridge lives: the page state needs the module, so the name is `bridge:<path from root>#<export>`. The browser loads the module with the loader of the core (`loadModule`), so the manifest got a `bridges` table next to the component bundles.
- The name is written by the Vite plugin as a call at the end of the module (`nameBridge`), not as an argument, so line numbers and source maps of the module stay valid.
- `Bridged.subscribe` handles a module that has not loaded: it returns a stop function at once and starts when the module has loaded. The first value is compared with the subscriber's first value with `sameData`, so only a subscriber whose data changed is written (the repair).
- `.source` is typed `S | undefined`, since it is undefined in the browser until a subscriber exists.
- `get set()` is `undefined` when the bridge has no `set`, so `canSet` and the `let` check work unchanged.
- A component, a function, a `let`, an unexported `const` and `export default` are BRM200. `export { name }` and `export { name as other }` of a `const` are valid.
- A bridge in the script of a `.brm` file is BRM200. A bridge exported from `<script module>` is allowed (maintainer, 2026-11-06): see below.

## Measurements

|                   | todos raw | todos gzip -9 | ui raw  | ui gzip -9 |
| ----------------- | --------- | ------------- | ------- | ---------- |
| before (f4e951f6) | 106,192   | 39,479        | 676,665 | 202,813    |
| after             | 106,275   | 39,491        | 676,839 | 202,887    |

The flag keeps the class, the plugin and the loader out of an app with no bridge; the rest is `isBridged` in `isForeignStore`, the check in `unsendable` and the feature code.

Checks: `oxlint` 0, `oxfmt --check .` 0, `pnpm typecheck` 0 (after building language-core, tsc, language-server and typescript-plugin), `pnpm test` 0 (brumate 2862 pass, 1 expected fail; ui 777), `node e2e/run.mjs --only ui --no-build` 55 of 55.

## Review fixes

See the Review fixes section of outcome.md. Dev note: the `bridges` flag is written in builds only, so there is no dev restart issue.

## `<script module>` (maintainer, 2026-11-06)

- Name: `bridge:<componentId>#<export>`, written as `$$nameBridge(local, name)` after the module script in the server module and in the `shared` part. No simpler route: the names have to be in code that runs on both sides, and the module script is copied into exactly these two.
- Load: the component's entry imports its `shared` part for a side effect when it has a bridge, and the component has client code (it is in the manifest). `bundles.ts` `load` and the dev manifest strip `bridge:` from an ID that is not a script file, so `loadModule(componentId)` loads it.
- BRM200: instance script, function, `let`, unexported `const`, and `export default` in `<script module>`. Its message names `<script module>`.
- Features: `getFeatures` sets `bridges` from `$$nameBridge(` in the output.

## Second review fixes

- Gated `isBridged` (`isForeignStore`, `subscribeSlot`) and the `bridge:` strip in `bundles.ts` behind `HAS_BRIDGES`. The strip in the generated non-bundle manifest is reached in dev only (a build returns the bundle form first), so it was left.
- Names come from `getFileName`, with no path of the machine.
- `export default` in `<script module>` reports only its own error (BRM066).
- Docs example imports `Context`.
- A bridge in `node_modules` was not collected; built in the follow-up commit (see below).
- Vite tests: dev and build for `<script module>`, and a package page in `packages.test.ts`.

## Installed packages

- Candidates are the dependencies of the app, by the walk of `findPackages`, that list `brumate` in `dependencies` or `peerDependencies`, scanned without their own `node_modules`. The scan runs in the `config` hook (now async) so `optimizeDeps.exclude` and `ssr.noExternal` name only packages with a bridge.
- Names use the package name and the path in it. `bridgeId` checks these packages first (with `realpath`, for pnpm links).
- Test: the page runs in a DOM put on the globals by hand (the plugin cannot load under the happy-dom environment, whose `URL` refuses `file:` URLs), with the loader and the manifest from the Vite server.

## Review of the installed-package fix

- Excluding a bridge package from `optimizeDeps` left its CommonJS dependencies unbundled in dev. The plugin now adds `<package> > <dependency>` to `optimizeDeps.include` for its installed dependencies and peers (not brumate, `@types/*` or excluded packages). Test: a nested CommonJS dependency is served from `.vite/deps`.
- Two installed copies of one bridge package shared a name, and the second replaced the first. Two versions now get `@<version>` in the name; two copies of one version throw.
- Docs say the package lists `brumate` in `dependencies` or `peerDependencies`.
- Left as is: a package with a `brumate` field is scanned only as components, so a bridge outside its `dir` is not found.
- Full suites under machine load (load average ~31): brumate and ui fail timing tests (differential-1 ResolveGoneChild, resume, ui happy-dom teardown) on ffd26e08 too, with a changing set. Examples, language-server, tsc, vscode and website pass.
