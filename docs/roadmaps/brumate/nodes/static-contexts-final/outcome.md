# Outcome: static-contexts-final

## Built

- The live-context path is gone. A `$setContext` value is read once.
  - Removed: `updateContext` and `madeStore` (`packages/brumate/src/runtime/client/context.ts`, exports in `runtime/client.ts`); the `provide` update in `codegen/client.ts` `emitBinding`; the `madeStore` rewrite and `storeSites` in `codegen/rewrite.ts`; `holdsStores` (`model.ts`, `analyze.ts`); `Analyzer.warnProvidedReads`.
  - `graph.ts`: a `$getContext` declaration is no longer live. `$route`, `$navigation` and `$store` declarations still are (the `context` kind without a `contextSource`). A plain `$setContext` site depends only on the reads outside a function, and does not follow a function that the value names (`{ toggle }` is not a read of what `toggle` reads).
  - `codegen/markup.ts`: only `$route` and `$navigation` pass a slot to `consumeContext`. `$getContext` passes none.
  - `$route()` and `$navigation()` still update their readers (`setGlobal`, `updateRoute`; the tests of routes and navigation pass).
- BRM196, a compile error: "The context value reads "{name}", which changes, but a context value is read once. Put it in a store with $toStore, or read it inside a function". Entry in `error-catalog.ts`, `test/error-codes.json`, `website/docs/errors.md` and the skill's `references/errors.md` regenerated with `UPDATE_SKILL=1`.
  - It fires when the value reads, outside a function, a signal, a memo, a prop or a `$bind` value that the graph says changes in the browser. A prop that no parent changes is fine; a single-file compile treats every prop as changing, as the graph already did. The client codegen reports it when the binding node of the provide site is live.
  - Allowed: a read inside a function (arrow, method, `.bind`), a function named in the value, `$untrack(...)`, `$toStore(...)`, a signal that nothing writes in the browser.
  - Not covered: a value that calls a function which reads a changing name (`$setContext(C, compute())`). The old warning did not cover it either.
- Development logs once per context when `provideValue` gets a different value for a key that the scope already provides (`warnChanged`).
- `callable` (`runtime/client/handlers.ts`) keeps the scope it finds for a `FunctionReference`, as `handlerProp` does. Needed, see Gotchas.
- Docs: `website/docs/context.md`, `website/docs/reference-signals.md`, `docs/decisions.md` (new entry), skill `references/signals.md`. `.changeset/static-contexts-final.md` (brumate, minor).
- Tests:
  - `packages/brumate/test/stores/stores.test.ts`: "a context value is read once" (BRM196 for signal, memo, prop; allowed forms; no `updateContext` in the client output). The old warning test and the `storeMixed` test are gone, with the fixtures `storeMixed.brm` and `stores/size/live`.
  - Fixtures that used the live path now use stores: `diamondChildren`, `diamondContext`, the `Tpl*` set, `themes` (new `ThemedLive.brm`, `ThemeStore`), `ctxReader`, the `spreadChildren*` set (`spreadChildrenShown.ts`), the `Spike*` select set (`SelectOpenContext`, `SelectValueContext`), `provide-functions`. Render snapshots updated.
  - `packages/ui/test/field-stores.test.ts` is two tests: every part compiles (no BRM196), and no part has `updateContext` in its client output.

## Result

Not an experiment node.

## Deviations

- Files outside the brief's shared paths: `docs/decisions.md`, `website/docs/reference-signals.md`, `website/docs/errors.md` and `packages/brumate/skills/brumate/references/{errors,signals}.md` (generated or demanded by tests, as earlier nodes did), `packages/brumate/test/error-codes.json`, `packages/brumate/src/runtime/client/handlers.ts` and `packages/ui/test/field-stores.test.ts`.
- `x` stays in `ScopeState`, in the page state record and in `consumeContext`'s slot record. Only `$route` and `$navigation` use it now. The brief listed it for removal, but `setGlobal` needs it.
- A bare function reference in a provided value is not a dependency of the provide site. Before, `{ toggle }` made the provide site depend on what `toggle` reads, which would be BRM196 for every handler.

## Stubs left

- `runtime/client/context.ts` still has what `store-repair-compare` edits: `subscribeSlot` with its `repair` compare (`!Object.is(found.get(), scope.s[slot])`), `linkRead`, `resumeStoreReads`, `consumeStore`, `toStore`, `storeUpdate`, `linkMadeStores`, `waitingReads`/`madeContexts` and the `CONTEXT_ADDED` hook (kept for default stores). The `LocaleContext` workaround (null default plus `?? DEFAULT_LOCALE` in 28 readers) is untouched.
- `provideValue` is the only writer of `scope.v` in the browser; `consumeContext` reads it. `findProvider` is shared by both.

## Gotchas

- Moved children keep a stale provider. `Popover` with a trigger that `keepsContent` (Select) renders its children in a hidden div first. When it opens, the `#if` swap shows the portal body and `destroyRange` destroys the old ListBox scopes, while the resumed items stay in the page. The items hold the server's `FunctionReference` of `select`, and `scopes.get(value.scope)` was undefined at the click (`change-handlers` test, "does not call the handler when a setter refuses"). On a9557034 the live update had given the readers `handlerProp` handlers that keep the scope object, which hid it. The fix keeps the scope in `callable`. The destroy of scopes whose markup moved is still there; I did not change it.
- A browser-rendered memo of an object that feeds `$toStore` recomputes when the component's code loads (`refresh` in `runtime/client/insert.ts`), and that sends the store again (`storeUpdate` forces). In the `spikeTemplate` differential the item scopes of a template were then created twice in the browser path. I avoided it by giving the fixture two stores of primitives. Not diagnosed further.
- `$store(source)` with a context declared in a `<script module>` is BRM194. Put the context in a `.ts` file.
- A fixture that read a context function to get a live value (`ctx.read()`, `shown()`) no longer updates. Give a store.
- Under load (load average above 12), many ui tests fail with timeouts, also on a9557034. Run the files alone. `bind-kept-writes` and `token-field-sync` failed on the base too in a loaded run.

## Proposed learnings

- A context holds stores for live data and functions for handlers | the context is read once | packages/ui/src | yes (field-stores test: BRM196)
- Put a context that `$store` reads in a `.ts` file, not a `<script module>` | `$store` of a module variable is BRM194 | packages/ui/src | yes (compiler)

## Verification

- `pnpm lint` (0 errors, warnings only), `pnpm format:check`, `pnpm typecheck`: pass.
- `npx vitest run` in packages/brumate: 79 files, 2829 tests pass.
- packages/ui: all files pass in small groups or alone, including `change-handlers`, `field-stores`, `bind-kept-writes` and `token-field-sync` (the last two flake under load, as on the base).
- `pnpm --filter website check:samples`: 67 samples, 0 problems.
- Every `.brm` file of the repo compiles with no BRM196 (scan of the whole tree, packages/ui and the examples included).
- `node e2e/run.mjs` (full, one run): todos 10, tracker 14, nitro 2, kit 5, ui 55, browser-async 6 pass; website 70 pass, 1 fail: `/docs/context: 3 live samples render`, sample 3 ("Live values with stores") imports `brumate/store`, which `website/src/live/run.ts` refuses ("A sample can import brumate and its own files"). The sample comes from store-contract; this node only changed bullets of that page. I did not run e2e on a9557034 to confirm. Left for the orchestrator: allow `brumate/store` in the live runner, or change the sample.
- `pnpm bench --only brumate --scenario todos`, the machine at load average 27 (timings are noise):

| | a9557034 | here |
| --- | --- | --- |
| JS before `load` (todos), gzip | 13.7 kB | 13.7 kB |
| Client JS emitted in dist, gzip | 27.6 kB | 27.6 kB |

- Ui example (`vite build` in examples/ui, `gzip -9` of each `.js` under dist, summed): a9557034 207,263 B, here 203,185 B (-4,078 B, -2.0%). Not a measure of `load`.

## Size

- Estimated M, actual M. The fixtures of the live path and the moved-children bug took most of the time.
