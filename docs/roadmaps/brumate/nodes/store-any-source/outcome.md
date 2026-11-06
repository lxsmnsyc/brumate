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
  - a store of another library in a prop and in a script value is refused at server render with the message above, and one made by a call in the reader works and a prop that no `$store` reads keeps the serializer's error (fixtures `storeForeignProp.brm`, `StoreForeignPropReader.brm`, `storeForeignValue.brm`, `storeForeignCall.brm`, `storeForeignRaw.brm`, `StoreForeignRawReader.brm`);
  - compile checks: BRM198 for `await` and a server function; every other source compiles and lands in `z`.
  - Fixtures: `storeAny.brm`, `StoreAnyReader.brm`, `storeSpace.ts`, `storeLetNone.brm`, `hasOptional.brm`, `hasOptionalAlone.brm`, `HasOptionalReader.brm`.

## Result

Not an experiment node.

Todos client JS, measured again after the review on clean builds. Method (`todos-clean.sh`, kept in the session scratchpad): put `packages/brumate/src` of the commit in place (`git checkout <commit> -- packages/brumate/src`), `rm -rf packages/brumate/dist` and `npx tsdown`, then in `benchmarks/brumate` `rm -rf dist node_modules/.vite`, `npx vite build --outDir dist/client` and `npx vite build --ssr src/server.ts --outDir dist/server`. Sum `wc -c` and `gzip -9 -c | wc -c` over every `.js` under `dist/client` (8 files). Two runs each:

|                   | todos raw          | todos gzip -9      |
| ----------------- | ------------------ | ------------------ |
| before (e87e290e) | 80,085 B, 80,085 B | 28,427 B, 28,427 B |
| after (f0e7f9d8)  | 80,086 B, 80,085 B | 28,418 B, 28,422 B |

Both sums move by a few bytes between runs because of the hashed chunk names: raw is the same within 1 B, and gzip is 5 to 9 B smaller. The first figures (28,423 B before, 28,415 B after) came from builds without the `node_modules/.vite` and `packages/brumate/dist` cleanup and should not be used.

The ui example (`examples/ui`, the same two builds, gzip -9 summed over `dist/client` JS): 677,928 B raw and 203,374 B gzip before, 677,603 B raw and 203,041 B gzip after (clean build, `dist` and `node_modules/.vite` removed). The key form (`$store(given.state)`) no longer imports the context into `z`. That saving outweighs the `($$s) => (…)` wrappers of the context imports (`$store(LocaleContext)` and the like) and the new resume code.

## Deviations

- `packages/tsc/test/tsc.test.ts` and `packages/tsc/test/fixture-has/src/Has.brm` changed (outside the shared paths) for the typing criterion: two lines, `$store(field?.state)` typed `{ count: number } | undefined`, and a wrong one. `packages/language-core` and `packages/tsc` source did not change.
- `packages/brumate/skills/brumate/references/errors.md`, `website/docs/errors.md` and `packages/brumate/test/error-codes.json` are generated from the catalog (as in store-contract).
- A store of another library in a prop or a sent script value is refused by the server's `$store`, not by a compile check (the maintainer, 2026-11-05; no new code). The compiler marks a source-form store whose root name is a sent value (`Declaration.store.sent`, `findSentRoot` in `analyze.ts`). It passes that name (`the prop "s"` or `the value "held"`) as a seventh argument of `$$ctx.consumeStore`, on the server only, so the browser code is unchanged. When the value is a contract that is not a `brumate/store` store, `consumeStore` throws `sentForeignStore(component, value)` (`runtime/store.ts`), the one place that holds the message: `$store in <component ID> reads a store of another library from the prop "s", which the page sends, and only a store of brumate/store crosses. Read the store from an import, <script module> or a call in this component`. Node store-bridge changes the fix there to point to `bridge()`. A foreign store in a prop that no `$store` reads keeps the serializer's error.
- BRM198 is a new code that the brief did not reserve (`reserves: []`). BRM194 could not take the new meaning, since `check-command.test.ts` pins each code to its message, and `skill.test.ts` needs a catalog entry for every compiler message.
- Limits kept, approved by the maintainer on 2026-11-05 and recorded in `docs/decisions.md`:
  - A source that awaits or calls a server function is BRM198. The browser links the store in the pass of the resume, and a promise is no store. silmaril and Svelte take no promise either.
  - `let` on a source that gives no store throws a `TypeError` when the variable registers, as `let` on a store without `set` does: a write would have nowhere to go.
  - A store that reaches the browser inside a sent value (a prop, a script value, a `$getContext` value read through a deeper path) must be of `brumate/store`. Only its value crosses, and the page state cannot carry a foreign store's functions. A foreign store works from an import, `<script module>`, a call or a namespace.
  - `$store(g?.state)` under `let` stays BRM197, like the explicit guarded `let`.
- The brief says the slot of a store that the expression makes "keeps the server value until the first change". The maintainer approved the general rule instead: the slot keeps the server value, and is written once at resume if the new store's first value differs (`store(Date.now())`). For `store(5)` the values agree, so nothing is written. The test checks that.

## Stubs left

- None of this node. `static-contexts-final` still owns the removal of the live context path.

## Gotchas

- A core bug found, not fixed here. It is node module-script-shared in the 0.6.1 patch. The render module (`codegen/render.ts`, `clientModuleScript`) copies `<script module>` instead of importing the shared part. A component that the browser renders gets its own module state, apart from the instances that resumed. So a `<script module>` store is two stores in the browser once a page both resumes and renders that component. The test "shares the store of <script module> between resumed and browser-rendered readers (module-script-shared)" is an `it.fails`, so it fails once that fix lands. Until then, `website/docs/context.md` says a `<script module>` store is two stores.
- A source runs once on resume, with the values the server sent. A signal that a handler changed before the reader's code loaded is not seen by the source (documented in context.md and the skill).
- Every source-form reader puts its source in `z` and gives slots to what the source reads, even if the reader's variable has no read in the browser.
- A store made by the source runs again on resume: a server-side `set` on it before the render is lost in the browser, except through the repair of the slot's value.
- `scope.stops` counts one entry per subscribed read. A reader whose source gave `undefined` has none for it.
- For ui-store-guards: `$store(given?.state)` where `given` is a guarded `$getContext` value is the short guarded form. It compiles to `has(C, scope) ? consumeStore(C, scope, slot, "state") : undefined`, the same as `$hasContext(C) ? $store(given.state) : undefined`. A prop or other non-context `given` uses the source form instead.

## Proposed learnings

- A `$store` source that is not a context is code the browser runs again on resume | resume runs no component code, so the source is compiled to an export like a memo's code | packages/brumate/src | yes (the `z` export test in stores.test.ts)

## Verification

After the review fixes:

- `npx oxlint`: exit 0, 0 errors (warnings only). Root `npx oxfmt --check`: pass.
- `npx tsc --noEmit -p .` in `packages/brumate`: pass.
- `npx vitest run` in `packages/brumate` (dist built with `npx tsdown`): 78 of 79 files pass in the full run. `test/resume.test.ts` failed at file level under load. Run alone it passes, 614 tests. The `it.fails` of module-script-shared counts as an expected fail.
- `npx vitest run` in `packages/tsc` (language-core and tsc built with `npx tsdown`): 3 pass, including the `$store(field?.state)` typing.
- `npx vitest run` in `packages/ui`: 773 pass, 1 expected fail. `test/bind-kept-writes.test.ts` (the Switch setter test) failed under load. Run alone it passes, 2 tests.
- `node e2e/run.mjs --only ui --no-build` (ui example built clean with its two `vite build` steps): pass.
- Before the review fixes: `node e2e/run.mjs --only todos,tracker,nitro,kit,browser-async --no-build` passed todos, tracker, nitro and kit. browser-async was not run, because `examples/browser-async` has no node_modules in this worktree. There is no `brumate` e2e suite.
- `UPDATE_SKILL=1 npx vitest run test/skill.test.ts test/check-command.test.ts` regenerated the error docs and pins.

## Size

- Estimated L, actual L.
