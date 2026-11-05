# Log: context-throw

- Baseline (before edits): todos bench client, `benchmarks/brumate` `vite build`, all chunks: 80135 B raw, 28445 B gzip -9.
- `createContext(key)`: one parameter. `Context` keeps `key` and gains an optional type-only `__type` so `Context<T>` still infers T.
- `isContext` in store.ts used `'defaultValue' in value`; it now checks a string `key` and that the object has one own key.
- Server `consume` throws `missingContext(key)` (runtime/context.ts); `$navigation` returns `{ pending: false }` on the server, `$route` stays computed from the request.
- Browser `consumeContext` seeds `globals` with `{ pending: false }` for the navigation key and throws for any other key with no provider. `findStore`, `linkRead` and `consumeStore` throw too.
- Removed `CONTEXT_ADDED`, `madeContexts`, `waitingReads`.
- Test fixtures: 24 `createContext` calls lost their default. Fixtures that read without a provider are in the differential skip list; `spikePage` wraps its two "alone" buttons in a `SpikeSelect`.
- Removed tests that relied on a default: storeTheme repair, storeKeyDefault, the "waits for the module" test, the select "part on its own" test, the `Themed` render snapshot.
- Tests added: server (`$getContext`, `$store`), browser render (`themedLater`, `themedStoreLater`), resumed store read.
