# Outcome: store-any-source

## Built

`$store(source)` takes any expression at the top level of a script that gives a store or a context that holds one. The limit of store-contract (a context, a key of a `$getContext` value or an import; BRM194 for the rest) is gone.

- **Sources that work** (server render, browser render, resume; `const` and `let`):
  - a context, `$store(Level)`, and a key of a `$getContext` value, `$store(field.state)`;
  - `$store(field?.state)` for a guarded `field` (`$hasContext(F) ? $getContext(F) : undefined`): it takes the guard of `field`, so it is `undefined` without a provider and links nothing;
  - an import, `$store(theme)`, a key of one, `$store(ns.theme)`, and a bare namespace import, `$store(ns)` (a module that exports `get`, `subscribe`, `set`);
  - a prop, `$store(s)`, and a key of one, `$store(given?.state)`;
  - a local store, `$store(store(5))`, a script value, `const local = store(0); $store(local)`, and a call result, `$store(make())`;
  - a `<script module>` value, `$store(shared)`;
  - `undefined` or `null`: the variable is `undefined`, nothing subscribes, nothing is recorded.
- **Two kinds of source**, chosen in `Analyzer.resolveStores` (`packages/brumate/src/analyze.ts`):
  - key form: a `$getContext` value `g`, `g.key` or `g?.key`. `store.source` is the context node and `store.path` the key. Page state `[key, slot, path?, 1?]`, found again from the provider as before.
  - source form: everything else. `store.link` is the index of the argument's site in `SemanticModel.storeSources` (was `storeImports: string[]`). Page state `[link, slot, undefined, 1?]`.
  - A context reached through the source form (`$store(Ctx)` for an imported `Ctx`) is still recorded by its key: the server picks the key when `isContext(source)` is true at run time.
- **Compile shape** (what ui-store-guards reads):
  - Server and browser render, unchanged call: `const x = consumeStore(<source>, scope, slot, path?, link?, write?)`, with the guard `has(C, scope) ? … : undefined` for a guarded read. In the source form `<source>` is the whole argument and `path` is `undefined`; in the key form it is the context and `path` the key.
  - `Declaration.store = { source, site, path?, link?, write }` (`model.ts`). `site` is the `setup` site of the argument.
  - `plan.ts` (`clientState`): every site of `model.storeSources` is a client site, so the values it reads get slots and are sent.
  - Update part (`codegen/client.ts`, `storeSources()`): `export const z = [($$s) => (<source rewritten for the browser>), …]`, one per source-form reader, in order of `link`. Example: `[($$s) => (store(5)), ($$s) => ($$b.get($$s, 1)), ($$s) => ($$b.get($$s, 0)?.state), ($$s) => (make$($$s)), ($$s) => (shared), ($$s) => (ns), ($$s) => (theme)]`. The update part is emitted whenever `z` is not empty, even with no update. A `<script module>` value comes from the shared part.
  - The key form no longer puts the context's import in `z` (it did so for defaults, which are gone).
- **Runtime**:
  - `findStored` (`runtime/store.ts`) returns `undefined` for `undefined`/`null`; under `let` it throws `TypeError` "`let $store(…) writes the store, but its source gives no store. Read it with const`".
  - Server `Context.consumeStore` (`runtime/server.ts`) returns `undefined` and records nothing for no store.
  - Browser `consumeStore` (`runtime/client/context.ts`) returns `undefined` and subscribes nothing.
  - `resumeStoreReads`: key reads link at once. The source reads of a scope wait for `loadModule(findRoot(scope).m)`, then run in one `pass`: `module.z[link](scope)`, `findStored`, `subscribeSlot(…, repair = true)`. The slot keeps the server's value; it is written once if `get()` differs. Nothing calls `set`.
  - `Module.z` (`runtime/client/state.ts`) is `((scope: Scope) => unknown)[]`.
- **Types** (`runtime/signals.ts`): a second overload, `$store<T>(source: Context<StoreLike<T>> | StoreLike<T> | undefined | null): T | undefined`. `$store(g?.key)` is `T | undefined` under strict with no error (`packages/tsc/test/fixture-has`).
- **BRM194 is removed** from the catalog and stays pinned in `test/error-codes.json` (a pinned code never changes its message). What still cannot work, a source that awaits or calls a server function (`Analyzer.checkStoreSources`), is the new **BRM198**: `The source of $store gives its store at once, so it cannot await or call a server function`. BRM192 keeps its pinned message.
- **BRM197**: `let x = $store(g?.state)` for a guarded `g`, and `$store(g.state)` without `?.` or a guard, stay BRM197.
- **Docs**: `docs/decisions.md` (the `$store` entry, three-source sentence replaced), `website/docs/context.md`, `website/docs/reference-signals.md`, skill `references/signals.md`; `website/docs/errors.md` and skill `references/errors.md` regenerated with `UPDATE_SKILL=1`. `.changeset/store-any-source.md` (brumate, minor).
- **Tests** (`packages/brumate/test/stores/stores.test.ts`):
  - "a store from any expression": server render of every source; resume with no `set` (every browser `Store.prototype.set` counted, and the namespace store counts its own); updates through `const` and `let`; the prop store is the parent's (one identity across records); a repair writes each reader's binding once; a browser render of every source; `let` on no store throws.
  - "`$store(field?.state)` for a guarded `$getContext` value": with a provider (server, resume, browser render) and without; BRM197 for `let` and for no `?.`.
  - compile checks: BRM198 for `await` and a server function; every other source compiles and lands in `z`.
  - Fixtures: `storeAny.brm`, `StoreAnyReader.brm`, `storeSpace.ts`, `storeLetNone.brm`, `hasOptional.brm`, `hasOptionalAlone.brm`, `HasOptionalReader.brm`.

## Result

Not an experiment node.

Client JS, gzip -9 summed over every `.js` file of `dist/client` (`vite build --outDir dist/client`, then the `--ssr` build), brumate dist rebuilt first:

|                   | todos raw | todos gzip | ui example raw | ui example gzip |
| ----------------- | --------- | ---------- | -------------- | --------------- |
| before (e87e290e) | 80,085 B  | 28,423 B   | 677,928 B      | 203,374 B       |
| after             | 80,086 B  | 28,415 B   | 677,604 B      | 203,043 B       |

Todos: +1 B raw, -8 B gzip (it has no `$store`; the runtime changes are tree-shaken or a few bytes). The ui example: -324 B raw, -331 B gzip. The key form (`$store(given.state)`) no longer imports the context into `z`, which pays for the `($$s) => (…)` wrappers of the context imports (`$store(LocaleContext)` and the like) and the new resume code.

## Deviations

- `packages/tsc/test/tsc.test.ts` and `packages/tsc/test/fixture-has/src/Has.brm` changed (outside the shared paths) for the typing criterion: two lines, `$store(field?.state)` typed `{ count: number } | undefined`, and a wrong one. `packages/language-core` and `packages/tsc` source did not change.
- `packages/brumate/skills/brumate/references/errors.md`, `website/docs/errors.md` and `packages/brumate/test/error-codes.json` are generated from the catalog (as in store-contract).
- BRM198 is a new code that the brief did not reserve (`reserves: []`). BRM194 could not take the new meaning, since `check-command.test.ts` pins each code to its message, and `skill.test.ts` needs a catalog entry for every compiler message.
- Limits kept, each needs the maintainer's approval:
  - A source that awaits or calls a server function is BRM198. The browser links the store in the pass of the resume, and a promise is no store. silmaril and Svelte take no promise either.
  - `let` on a source that gives no store throws a `TypeError` when the variable registers, as `let` on a store without `set` does: a write would have nowhere to go.
  - A store that reaches the browser inside a sent value (a prop, a script value, a `$getContext` value read through a deeper path) must be of `brumate/store`. Only its value crosses, and the page state cannot carry a foreign store's functions. A foreign store works from an import, `<script module>`, a call or a namespace.
  - `$store(g?.state)` under `let` stays BRM197, like the explicit guarded `let`.
- The brief says the slot of a store that the expression makes "keeps the server value until the first change". Built as the general rule instead: the slot keeps the server value, and is written once at resume if the new store's first value differs (`store(Date.now())`). For `store(5)` the values agree, so nothing is written. The test checks that.

## Stubs left

- None of this node. `static-contexts-final` still owns the removal of the live context path.

## Gotchas

- A core bug found, not fixed (not a store bug, and on main): the render module (`codegen/render.ts`, `clientModuleScript`) copies `<script module>` instead of importing the shared part. A component that the browser renders gets its own module state, apart from the instances that resumed. So a `<script module>` store is two stores in the browser once a page both resumes and renders that component. The test "reads each source in a browser render" notes it and checks the browser-rendered reader alone. It needs a fix from main.
- Every source-form reader puts its source in `z` and gives slots to what the source reads, even if the reader's variable has no read in the browser.
- A store made by the source runs again on resume: a server-side `set` on it before the render is lost in the browser, except through the repair of the slot's value.
- `scope.stops` counts one entry per subscribed read. A reader whose source gave `undefined` has none for it.
- For ui-store-guards: `$store(given?.state)` where `given` is a guarded `$getContext` value is the short guarded form. It compiles to `has(C, scope) ? consumeStore(C, scope, slot, "state") : undefined`, the same as `$hasContext(C) ? $store(given.state) : undefined`. A prop or other non-context `given` uses the source form instead.

## Proposed learnings

- A `$store` source that is not a context is code the browser runs again on resume | resume runs no component code, so the source is compiled to an export like a memo's code | packages/brumate/src | yes (the `z` export test in stores.test.ts)

## Verification

- `npx oxlint`: exit 0, 0 errors (warnings only). Root `npx oxfmt --check`: pass.
- `npx tsc --noEmit -p .` in `packages/brumate`: pass.
- `npx vitest run` in `packages/brumate` (dist built with `npx tsdown`): 79 files, 2840 tests pass, the store tests 46 of them.
- `npx vitest run` in `packages/tsc` (language-core and tsc built with `npx tsdown`): 3 pass, including the `$store(field?.state)` typing.
- `npx vitest run` in `packages/ui`: 75 files, 774 pass, 1 expected fail.
- `node e2e/run.mjs --only ui --no-build` (ui example built with its two `vite build` steps): pass.
- There is no `brumate` e2e suite. `node e2e/run.mjs --only todos,tracker,nitro,kit,browser-async --no-build`: todos, tracker, nitro and kit pass (each example built with its `npm run build`). browser-async not run: `examples/browser-async` has no node_modules in this worktree, so it does not build.
- `UPDATE_SKILL=1 npx vitest run test/skill.test.ts test/check-command.test.ts` regenerated the error docs and pins.

## Size

- Estimated L, actual L.
