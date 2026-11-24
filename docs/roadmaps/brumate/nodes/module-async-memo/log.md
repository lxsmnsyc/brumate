# Log: module-async-memo

## 2026-11-24

- Worktree from origin/main 542a0658. `pnpm install`, `pnpm build` pass.
- Check: `$memo(await …)` at the top level is BRM211 (`findAwait` in `src/module-signals.ts`), and `$memo(promise)` compiles to `heldDerived`, whose value is the promise. No part of the node exists.

### Prior art

- Solid Router `createAsync`, last version before its removal: https://github.com/solidjs/solid-router/blob/e54fc4a3bc51d0727df052603a7c92d9da8e099b/src/data/createAsync.ts. It wraps `createResource`. While the page hydrates (`sharedConfig.context`), `subFetch` swaps `fetch` and `Promise` for a `MockPromise`, so the browser takes the value that the server sent and does not load again.
- Solid `createResource`, v1.9.3: https://github.com/solidjs/solid/blob/73822b287f4d38e219588e6ee7f64fa712663598/packages/solid/src/reactive/signal.ts (lines 623-626) and the server version in `packages/solid/src/server/rendering.ts` (lines 387-412). The browser finds the server value by a hydration id, taken from `sharedConfig.context`, which exists only while a component renders. On the server the resource is kept in `sharedConfig.context.resources` of the request. A resource made at the top level of a module has no context: the browser loads again, and the server has no request to keep it in. Solid does not resume a module-level resource.
- Svelte 5 `$derived` with `await`, main: https://github.com/sveltejs/svelte/blob/1aadba4c8c307c14a53833626e7cf7929bcf9ed8/packages/svelte/src/internal/client/reactivity/deriveds.js (`async_derived`, line 321) throws `async_derived_orphan` ("Can only create a `$derived(...)` with an `await` expression during component initialization or in a declaration tag") outside a component. Svelte has no module-level async derived.
- Neither has the form. What carries over: the browser keeps the value that the server rendered and loads only when a source changes (Solid's hydration rule), and a load that a newer run replaced is dropped.

### How a component memo resumes

- Server: `$$b.memo(() => …)` computes on first read, `stateValue` puts the value (or a promise that streams) in the slots of the scope. Browser: the slot holds the value, the memo runs only when a slot it reads is written, so a resume never loads. `$store` reads link the slot to the store (`subscribeSlot`) and repair a value that differs from the server's.

### Design

- The importer reads an imported module memo as a memo of its own: `const in = $store(memoInputs(store))` and `const name = $memo(loadMemo(store, in))` (`$memo(await …)` when the module memo awaits). So `#loading`, `await name`, `$isPending`, `$resolve`, BRM182 and `#try` are those of a component memo.
- The slot of `in` holds the values of the memo's sources. The server sends them, and the browser compares them with its own on resume: equal sources keep the server value and load nothing; other sources load again (the repair of #530 for a memo). A change of a source in the browser writes the slot, and the memo of the importer computes again.
- The module memo is a new store, `memoStore`, that loads once for all its readers: one load per change of the sources, only the latest run is written, a stream is read once and each value goes to every reader.
- Why every imported `$memo` takes this path: a promise value (`$memo(fetchUser(id))`) cannot be told from a plain value before the memo computes, and the browser must not compute on resume. With the value in a `$store` slot (the #530 path), the server has no memo to wait for, so `#loading` and `await name` cannot work, and resume would need the browser to compute.
- First run: the #530 tests passed after two fixes (a new subscriber heard the first compute; `release` resolved the wait before the value was written). Streams in `#loading` stream after the first flush, so `resume()` of the test now appends the `pending` chunks.
- Shared-load rule chosen: one load per set of source values for the process, shared while out and after; a failed load is held until a source changes. A retry on the server after a failure was dropped: two components of one request would each start a load.
- Not built: seeding the browser store from the slot of an importer, so module code that reads the memo in the browser loads it once. Noted in the docs and the outcome.
- `heldDerived` removed: nothing calls it now; its unit test runs on `memoStore`.

### Review of #531 (head 746969be)

- Fixed: a sync memo kept a stale value when a component followed it after a source changed (follow at 0 -> 1 checks the sources once it has run).
- Fixed: the page state no longer carries source values. The `$store` slot holds the value, and the browser store takes it on resume through `subscribeSlot` (feature `moduleMemos`), as a bridged store does. A value that loaded goes as a promise in the prop-promise wrapper, since the browser replaces a plain promise in a slot with its value, and a sync value is computed again in the browser to repair a value of other sources (the #530 repair test).
- Fixed: `$gate`, `$debounced` and `$throttled` compile to `memoStore` with options, so they wait for a memo that loads, and the importer reads them as memos. `gated`, `timed` and the `hold` path of `build` removed.
- Fixed: module code that reads the memo after resume gets the server value, with no load.
- Fixed: a failed load on the server is shared by the renders that read its run; `brumate.render` (the call results of a render) tells the renders apart. It is set with `??=` because the test loads a second copy of the server runtime.
- `onServer()` is false after an `await` of a render in happy-dom, so `i.get` tells server from browser by whether the store has a subscriber.

### Review round 2 (a1ab4db6)

- A value that loaded now goes as `[promise, sources]`, the sources by name (the compiler passes `n`). The browser compares them with its own (`sameData`) and loads once when they differ. A plain array keeps the promise a promise in the browser, so the prop-promise wrapper is gone.
- A value that computed at once goes as `0`, or as itself when it is an object (shared by reference with the memo slot); the browser recomputes it, and a marker makes the importer's memo compute once (`fresh`).
- A source of a loaded memo that cannot be sent: `unsendable` in `server.ts` names the source and the memo.
- `brumate.render` is now the calls map itself, which `withEvent` writes and restores on `globalThis`, so every copy agrees.
- A failed run is kept per render (`failed`, a WeakMap); a render that read it gets its error for the rest of the render, also after a later render loaded again.

### Review round 3 (522dc843)

- `readers` held every render's calls map for a memo that never recomputes. Now it holds renders only while a load is out: `finish` copies it into `failed` on a failure and clears it, and a render that reads a held error goes into `failed` directly. `h()` gives its size for the test.
- The sync marker is `{ $$ms: 0 }`, which no value equals, so the repair of each importer writes its slot (the `fresh` flag of round 2 served the first importer only).
- A loaded value goes as `{ $$ms: promise, s: sources }`; a sync value that holds a promise is no longer read as one that loaded.
- Sources compare with `sameSource`: dates by time, maps and sets by entries, regular expressions by source and flags, typed arrays by items. `sameData` of the shared paths is unchanged.
