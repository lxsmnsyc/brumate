# Outcome: memo-prop-browser-child

## Built

- `packages/brumate/src/graph.ts`: a memo whose expression is a bare prop that `$props<T>` types as `Promise<...>` (or a union with one) is live (`isPropValue`; `analyze.ts` sets `Declaration.promise`). A `$memo` of any other prop keeps main's output (codegen test "memo of a prop"), so a child that the browser renders gets update code for its readers. The existing `setSlots` and `asyncMemo` path then writes the value, or the error to `#catch`, when the promise settles.
- Tests in `test/resume.test.ts` ("loads a memo in a child that the browser renders"), fixtures `PromiseMemoChild.brm`, `promiseMemoBrowser.brm`, `promiseMemoBrowserReject.brm`: the value shows after the promise resolves, and a rejection shows the `#catch` body. They fail on main (`[object Promise]`, no `#catch`). The resumed tests of #373 still pass.
- `runtime/html.ts`: a pending promise inserts as empty text (`insertValue`, `textValue` for `<textarea>`; any object with a `then`, as the server's `insert` checks) and writes no attribute (`attributeText`), so a browser-rendered child no longer shows `[object Promise]`. Test: "shows a pending memo of a promise prop as empty text and no attribute" (fixtures `PromiseMemoAttrChild.brm`, `promiseMemoAttr.brm`).
- `website/docs/async-data.md`: notes the missing fallback in browser-rendered markup.
- Changeset: brumate patch.

## Deviations

- The root cause is in the compiler graph, not the client runtime: the memo had no live readers, so no update code. The brief's acceptance "shows the `#loading` fallback, then the value" is only half met: the value and `#catch` work, the fallback does not. The client render of `#loading` has no fallback (it renders the body in place), so until the promise settles the child shows empty text (maintainer decision: the fallback moves to a 0.5.0 node). Needs a compiler change; see Gotchas.

## Stubs left

- None.

## Gotchas

- `#loading` has no fallback in markup that the browser renders (`codegen/markup.ts`, client mode). A follow-up node should render the fallback while the memos of the body are pending and swap on settle.
- `$memo(await load())` and `$memo(load())` in a child that the browser renders have the same gap as the prop memo had. Marking every async memo or every memo that reads a prop as live changed the server output of root pages (8 tests failed), so only the bare prop memo is live.

## Proposed learnings

- None.

## Verification

- New tests fail on main and pass on the branch. `pnpm --filter brumate test`: 1270 tests pass. `pnpm lint` (only existing e2e warnings), `pnpm format:check`, `pnpm typecheck` pass.
- Todos bench, client JS in dist: 80.8 kB / 28.8 kB on main, 80.9 kB / 28.8 kB on the branch.

## Size

- Estimated S, actual S (the fix is a few lines; most time went to finding that the cause is in the graph and that a broad rule changes server output).

## After the rebase onto #376

- A promise-typed prop that a memo reads is now a slot, so its rejection reached the page state with the real message. In production `Context.slots` (`runtime/server.ts`) now wraps the promise of a `PropPromise` so a rejection carries a generic error (the message of a `ServerError`, else "The page could not compute a value"). It does not log; the read of the memo or the `#catch` logs the real error. The #373 test of a rejected prop in a handler runs in dev (real error) and in production (generic error).
