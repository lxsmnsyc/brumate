# Outcome: memo-prop-browser-child

## Built

- `packages/brumate/src/graph.ts`: a memo whose expression is a bare prop (`$memo(user)`) is live (`isPropValue`), so a child that the browser renders gets update code for its readers. The existing `setSlots` and `asyncMemo` path then writes the value, or the error to `#catch`, when the promise settles.
- Tests in `test/resume.test.ts` ("loads a memo in a child that the browser renders"), fixtures `PromiseMemoChild.brm`, `promiseMemoBrowser.brm`, `promiseMemoBrowserReject.brm`: the value shows after the promise resolves, and a rejection shows the `#catch` body. They fail on main (`[object Promise]`, no `#catch`). The resumed tests of #373 still pass.
- `runtime/html.ts`: a pending promise inserts as empty text (`insertValue`) and writes no attribute (`attributeText`), so a browser-rendered child no longer shows `[object Promise]`. Test: "shows a pending memo of a promise prop as empty text and no attribute" (fixtures `PromiseMemoAttrChild.brm`, `promiseMemoAttr.brm`).
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

- New tests fail on main and pass on the branch. `pnpm --filter brumate test`: all tests pass. `pnpm lint` (only existing e2e warnings), `pnpm format:check`, `pnpm typecheck` pass.
- Todos bench, client JS in dist: 80.8 kB / 28.8 kB on main and on the branch (no change).

## Size

- Estimated S, actual S (the fix is a few lines; most time went to finding that the cause is in the graph and that a broad rule changes server output).
