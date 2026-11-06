# Outcome: context-throw

## Built

- `createContext<T>(key)` has one parameter (`packages/brumate/src/runtime/context.ts`). `Context<T>` has `key` and an optional type-only `__type?: T`. No runtime code reads a default.
- `missingContext(key)` in `runtime/context.ts` makes the error. Exact message:
  `The context "<key>" has no provider above this component. Provide it with $setContext, or in a parent that does`
- Server (`runtime/server.ts`, `Context.consume`): throws `missingContext` when no scope above provides the key. `$route` is still built from the request, and `$navigation` gives `{ pending: false }`.
- Browser (`runtime/client/context.ts`): `consumeContext`, `findStore` (resumed `$store` reads) and `consumeStore` throw `missingContext` when `findProvider` finds none and the key is not a global. `$route` comes from `location`, and `$navigation` starts as `{ pending: false }` (seeded in `globals`).
- `routeContext` and `navigationContext` lost their defaults.
- Deleted: `CONTEXT_ADDED`, `madeContexts`, `waitingReads`, and the waiting path of `linkRead`.
- `isContext` (`runtime/store.ts`) no longer checks `defaultValue`: a context is an object with exactly one own key, a string `key`, that is not a store contract.
- `.changeset/context-throw.md`: brumate, minor.
- Tests (`packages/brumate/test`): the 24 `createContext` calls in fixtures take only a key. Server tests in `render.test.ts` ("a context without a provider": `$getContext`, `$store`, arity). Browser-render tests in `resume.test.ts` (fixtures `themedLater.brm`, `themedStoreLater.brm`). A resumed store read test in `stores/stores.test.ts`.

## Result

Not an experiment node.

Todos client JS (`benchmarks/brumate`, `vite build`, every chunk):

|                   | raw      | gzip     |
| ----------------- | -------- | -------- |
| before (4ea04dbe) | 80,135 B | 28,445 B |
| after             | 80,086 B | 28,410 B |

The change is -49 B raw and -35 B gzip. The todos page has no stores, so little of the removed code was in its bundle.

## Deviations

- `Context<T>` has the optional type-only `__type` field besides `key`, because `T` cannot be inferred from `Context<T>` otherwise.
- `isContext` requires exactly one own key. Without the `defaultValue` check, any object with a string `key` would count as a context.
- `NAVIGATION_KEY` is handled in `consume` and `consumeContext` like `ROUTE_KEY`, since the runtime provides it to every page.
- Deleted tests that tested a default, since the behavior is gone: the `storeTheme` repair test (the imported-store test covers repair), `storeKeyDefault`, "a read that waits for the module of its context", the select "part on its own" test, and the `Themed` render snapshot. Fixtures `storeTheme`, `storeKeyDefault` and `StoreMixedReader` went with them. `spikePage.brm` wraps its two "alone" buttons in a `SpikeSelect`.
- 14 names are in the differential skip list (`test/differential/data.ts`), because they read a context a parent provides: ContextAs, CounterButtons, CtxWriterLoopMid, FnReadContextMid, SpikeButton, SpikeLabel, SpikePopover, SpikeValue, Themed, ThemedLive, TplReader, TplRelay, themedLater, themedStoreLater.
- `packages/brumate/skills/brumate/references/state.md` still shows `createContext('light')`. It is outside the shared paths and is left for context-docs.
- No other file outside the shared paths changed.

## Stubs left

- `packages/ui` still passes defaults. `brumate-tsc --noEmit` there reports 61 errors, all TS2554 "Expected 1 arguments, but got 2" at `createContext` calls in `src/` (contexts.ts 24, collection.ts 5, calendar.ts 3, menu.ts 3, navigation-tree.ts 2, the rest one each). The ui-no-defaults nodes fix them. The ui tests were not run.
- `$hasContext` and optional reads: node has-context. The `LocaleContext` workaround in ui is untouched.
- `website/docs/context.md`, `docs/decisions.md` and the skill's `state.md`: node context-docs.

## Gotchas

- For has-context: the browser lookup is `findProvider(scope, key)` in `runtime/client/context.ts`. It starts at `scope.t ?? scope.p ?? scope.o`, so a scope reads the contexts above it, not its own. The server walk is `Context.consume` in `runtime/server.ts` (the loop over `parent` ids, then the `ROUTE_KEY` and `NAVIGATION_KEY` cases, then `missingContext`).
- A guarded `$store` (`$hasContext(C) ? $store(C) : undefined`) must skip every throwing path when the context is missing: `consumeContext`, `findStore` (called by `linkRead` on resume) and the `readContext` callback of `consumeStore`. Resume calls `linkRead` for each recorded read, so a guarded read with no provider must not be recorded.
- A page that reads a context with no provider fails to render. A test that renders such a component alone must provide the context or be a differential skip.
- A resumed `$store` read whose provider scope is missing from the page state throws inside `pass`, with the same message.
- To typecheck `packages/ui` in a fresh worktree, build `packages/tsc` and `packages/language-core` with `npx tsdown` first.

## Proposed learnings

- A context carries no value: read it only under a provider | a default is one object for every request on the server | packages/brumate/src/runtime | yes (the server and browser tests)

## Verification

- `npx oxlint`: 0 errors (warnings only). Root `npx oxfmt --check`: pass.
- `npx tsc --noEmit -p .` in `packages/brumate`: pass.
- `npx vitest run` in `packages/brumate`: 79 files pass.
- `npx brumate-tsc --noEmit` in `packages/ui`: 61 errors, all TS2554.

## Size

- Estimated M, actual M.
