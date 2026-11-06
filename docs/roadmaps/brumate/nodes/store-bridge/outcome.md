# Outcome: store-bridge

## Built

- `bridge({ create, get, subscribe, set? })` in `brumate/store`: returns `(snapshot?) => BridgedStore<S, T>` with `.source`. Types `BridgeOptions`, `Bridge`, `BridgedStore`.
- Server: `create(snapshot)` runs once for each call, so a store made in a provider belongs to its request. `$store` reads it like any store; `isForeignStore` no longer counts it.
- Page state: the data from `get` and the bridge name `bridge:<file>#<export>` (`BridgePlugin`, `$b.g(data, name)`). In the browser the store is a `Bridged` that makes the library's store with `create(snapshot)` at its first subscriber, once for all readers and prop holders (the serializer shares the object across records). If the module has not loaded, `subscribe` starts when it has. A first value that differs from the server's repairs the slot of each subscriber once. Resume never calls `set`.
- Names: the Vite plugin appends `nameBridge(local, name)` to a script with a bridge. The manifest has a `bridges` table, in dev and in build, and `loadModule` loads `bridge:<file>`. The core sets the loader (`setBridgeLoader`) at `init`.
- BRM200: `The value of bridge() must be a module-level export of a script file, as "export const name = bridge({ … })"`. Reported for a call in a component (analyzer), by the Vite transform, and by `brumate check` (it now reads script files for it).
- Server error when `get` gives unsendable data: `The store "badStore" of bridge() in bears.ts gives data from get that cannot be sent to the browser (<reason>), and the context "bad" sends it. Return plain data from get, …` (or `the prop or value "x" in <Component>`).
- The error for a store of another library in a prop or a script value, and the one for a provided value, point to `bridge()`.
- Feature flag `bridges` (`__BRUMATE_HAS_BRIDGES__`): the Vite plugin turns it on when the app has a script with a bridge.
- Docs: context.md "Outside stores", reference-signals.md `bridge`, skill signals.md and errors.md, website errors.md, decisions.md (`$store` entry, with React and Svelte links), `.changeset/store-bridge.md` (minor).
- Tests: `test/stores/bridge.test.ts` (14: server isolation, resume through a context with `const` and `let`, a prop, a reader the browser renders, the repair, `.source` after the first subscriber, `let` without `set`, the two unsendable errors, naming forms, BRM200 in a script, a component and `brumate check`), a Vite dev and build test, with a zustand-shaped stand-in (`test/stores/bridge/zustand.ts`).

## Deviations

- The brief's example has no type on the export. The tests and docs annotate it (`Bridge<S, T>`), since repos with `isolatedDeclarations` need that.
- None for `<script module>`: the maintainer decided on 2026-11-06 to lift the limit in this node. A bridge exported from `<script module>` is named `bridge:<componentId>#<export>` by the server module and the shared part of the component. The entry of the component imports its shared part when it has such a bridge, so `loadModule(componentId)` registers it even if no other part reads it, and the component counts as having client code. `export default` is not a form of `<script module>` (BRM200).
- `export default bridge(...)` works after review: the transform rewrites it to a `const` plus `export default`, named `#default`.
- `.source` is typed `S | undefined`. A handler that runs before the module has loaded sees `undefined`; the docs say so and use `?.`.
- `brumate check` now parses scripts for `bridge` (only files that contain both `bridge` and `brumate/store`).

## Measured

Client JS, `npx vite build --outDir dist/client`, `gzip -9c` summed over every `.js`:

|                | before (f4e951f6)          | after                      |
| -------------- | -------------------------- | -------------------------- |
| examples/todos | 106,192 raw / 39,479 gzip  | 106,275 raw / 39,498 gzip  |
| examples/ui    | 676,665 raw / 202,813 gzip | 676,845 raw / 202,916 gzip |

Before the `bridges` flag the same builds were 39,816 (todos) and 203,563 (ui) gzip. The flag keeps the class and the plugin out of apps without a bridge.

Checks: oxlint, `oxfmt --check .`, `pnpm typecheck`, `pnpm test` (brumate 2862, ui 777), `node e2e/run.mjs --only ui --no-build` 55 of 55.

## Gotchas

- `pnpm typecheck` needs the dist of language-core, tsc, language-server and typescript-plugin (`npx tsdown` in each) in a fresh worktree.
- The registry of bridges is on `globalThis` (`Symbol.for('brumate.bridges')`), so any copy of the runtime sees it. The tests clear it before the loader starts, so the browser path that loads the module is the one tested.
- `Bridged.subscribe` compares with the value the subscriber saw when it subscribed, not with the server's, so a second subscriber of a late store is repaired too.
- The browser render module copies `<script module>` (`codegen/render.ts`, `clientModuleScript`) and has no naming call. A bridge made by that copy is never sent, since a browser-made store is not in the page state, so this is harmless. The naming calls are in the server module and the `shared` part only.
- Installed packages (follow-up commit `find bridges in installed packages`): `findBridgePackages` walks the dependencies of the app as `findPackages` does and returns those that list `brumate` in `dependencies` or `peerDependencies` and are not packages of components. The plugin scans only those (prefilter plus parse, skipping their `node_modules`). A package with a bridge goes into `optimizeDeps.exclude`, `ssr.noExternal` and `resolve.dedupe: ['brumate']`, so the transform names it in dev, SSR and build; a package without one changes nothing. Names are `bridge:<pkg>/<path in package>#<export>`, and the files join the manifest table and the `bridges` flag. `test/bridge-packages.test.ts` has a real copy in `node_modules` with compiled `.js` and `export { a as bears }`: dev (config, manifest, names, resume with one source for each bridge) and build.
- Names: a bridge of a script file is `bridge:<name of the file>#<export>`, where the name is the one components use (`src/bears.ts`, or `@acme/ui/src/bears.ts` in a package), so the page state holds no path of the machine. A script outside the root that is not in a package is named by its path from the root but is not in the manifest.
- Gate: `isBridged`, the `bridge:` strip of `bundles.ts` and the repair baseline in `subscribeSlot` are behind `HAS_BRIDGES`. The `bridge:` strip of the generated non-bundle manifest is dev only.
- Dev: features are not written in the dev server (`!isServe`), so the `bridges` flag is a build matter only; a first bridge file added in dev needs no restart for the flag.

## Review fixes

- The repair now runs in both paths of `Bridged.subscribe` (the module loaded already, or not); the resume path passes the slot's server value as the baseline. Test: a browser-rendered reader with the module loaded.
- `findBridgeFiles` confirms with a parse (a comment or a helper that names both words is not a bridge).
- `set` is decided from the server (a flag in the page state) before the module loads, so `let` on a bridge without `set` throws at registration.
- A failed load or a missing export goes to `onError` (`failBoundary`), not to an unhandled rejection.
- Bridges in packages outside the root are scanned like `findServerFiles` directories.

## Follow-ups

- A browser e2e with a real zustand in an example app.

## Sizing

Estimated M, actual L: the page-state form, the manifest, the compiler checks and the `<script module>` form.
