# Outcome: promise-prop-memo

## Built

- A promise prop is a plain promise in the child. The browser no longer unwraps it (`runtime/client/props.ts` writes the promise to the slot and records it in `Scope.plain`). After resume, a streamed promise prop is a promise that the stream settles (or rejects), not the bare value (`client/resume.ts`). A browser-rendered child keeps the promise too (`client/components.ts`, `setSlots`). `get()` and `pending()` in `client/updates.ts` skip the loading rules for `plain` slots, so `await user`, `user.then(...)` and passing it on work in a handler, an effect and a `$client` callback, before and after it settles. `$memo(user)` still loads the promise as an async memo: old value kept, `$isPending` true, `#loading` works.
- Server side: the compiler passes the scope to `unbind` (`$$ctx.sink($$s1)` on the server, `$$b.sink($$s1)` in render modules), which collects the promise props on it, `Context.slots` wraps the first slot that holds one in `PropPromise`, and a seroval plugin writes it as `$b.q(promise)` (serial.ts, `stateValues.q`). The server render of the child is unchanged: it always saw the promise.
- Docs: `docs/decisions.md` (new entry, supersedes Q6 of pending-handler-reads, decided by the maintainer 2026-10-30; the line on loading slots no longer lists promise props), `website/docs/async-data.md` ("Promises as props"). Changeset: brumate minor.
- Tests (`test/resume.test.ts`, fixtures `promisePlain.brm`, `PromisePlainChild.brm`, `promiseBrowser.brm`): a child awaits, chains, runs an effect and a `$client` callback on a streamed promise prop, before and after it settles, with `$memo(user)` under `#loading` showing Loading then the value; a child that the browser renders awaits and chains its promise prop. A rejected streamed promise prop rejects `await user` in a handler and reports no unhandled rejection (also when nobody reads it); the memo of a promise prop that rejects shows the `#catch` body. They fail on main. The old test that expected a throw in a handler reading a promise prop and its fixtures (`promiseProp.brm`, `PromisePropChild.brm`) are gone.

## Deviations

- BRM186 was dropped (first version of PR #373: a compile error for any read other than `$memo(prop)`). The maintainer decided a prop is a value like any other, so the fix is in the runtime. BRM186 is free again; nothing of it is left in the catalog, docs or tests.
- Touched runtime files outside the brief's shared paths (the brief now describes the runtime change): `shared.ts`, `serial.ts`, `server.ts`, `client/{props,resume,components,state,updates}.ts`.

## Stubs left

- None.

## Gotchas

- `resume.ts` and `setSlots` attach a no-op catch to a promise prop, so a rejection that the child never reads is not reported (tested).
- A memo of a prop in a child that the browser renders does not load its promise (no update code is generated for it): same as on main, not part of this node.
- `$isPending(prop)` of a promise prop itself is false: the prop is a plain value; use a memo of it.
- The effect of a child no longer reruns when its promise prop settles (the slot does not change). It runs when its other dependencies change, or the effect awaits the promise.

## Proposed learnings

- None.

## Verification

- Probe and new tests fail on main (`value.then is not a function`) and pass on the branch.
- Todos bench, JS before `load` gzip: 15317 B on main, 15437 B on the branch, +120 B (within 0.3 kB).
- `pnpm lint` (no errors outside docs/debates), `pnpm format:check`, `pnpm typecheck`: pass. `pnpm --filter brumate test`: 1260 tests, all pass (`scope-ids.test.ts` lists `PropPromise` as a class without IDs). `pnpm --filter website check:samples`: 65 samples, 0 problems. `pnpm --filter website build`: pass.

## Size

- Estimated M, actual M.
