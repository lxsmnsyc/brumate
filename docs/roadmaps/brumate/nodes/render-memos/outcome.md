# Outcome: render-memos

## Built

- packages/brumate/src/codegen/patch.ts: a new mode `render` of `addValueEdits`. A `$memo` that can give a promise compiles to `$$b.renderMemo(() => (expr))` (`async () =>` with `await`), and each read of such a memo to `$$b.readMemo(name)`. Memos of a primitive, an array or a function stay plain.
- packages/brumate/src/codegen/render.ts: the render module uses the mode `render`.
- packages/brumate/src/codegen/primitive.ts: `isPrimitive` moved from scopes.ts (a cycle otherwise), with `neverPromise` (moved from markup.ts).
- packages/brumate/src/runtime/client/components.ts: `renderMemo` holds a throw in a `MemoError` and marks a promise or stream. `readMemo` throws the held error at the read, as the server's `$$b.read` does. `setSlots` starts the load of a marked slot with `asyncMemo` after the insert (`afterInsert`), and keeps the early write of the settled value, so the boundary of `countLoads` waits for it as before.
- packages/brumate/src/runtime/client/insert.ts: `refresh(live, true)` after each browser insert is gone, with `memosOnly`. `refresh` gets a `memos` flag instead; `give` (waits.ts) turns it off, since a held body's memos got the writes of the hold.
- packages/brumate/src/runtime/client/waits.ts, state.ts, updates.ts, resume.ts: `renderedLoads` and `settledSlots` are gone, as nothing consumes them. `asyncMemo` returns its load number.
- packages/brumate/test/differential/data.ts: causes debounce-start and function-prop-reads leave the list (timing, fnReadUntrack match). memo-throw keeps 4 of its 5 pages (see Deviations).
- packages/brumate/test/codegen.test.ts: 2 expectations updated, 1 test added. 5 render snapshots updated.
- .changeset/render-memos-once.md (patch).

## Deviations

- memo-throw does not leave the list. Its html and errors now match on all 5 pages, and memoErrorResume matches fully. The 4 others differ only in the slot of the failed memo: the server's page state holds `undefined` there (the server render keeps `bad` unset after the throw) or the error with its properties in another order (memoErrorResumeShown), and the browser render holds the held error, which a later read must throw. The cause text says so now. Making the slots equal would need the browser to hold nothing for a failed memo, so a later read would not throw.
- The audit's estimate was net 0 B. The reads of memos got a `readMemo` wrap, which costs bytes in ui (see Size).

## Stubs left

- None.

## Gotchas

- `give` used to run the memo updates of a held body again after the body entered the page, which `renderedLoads` hid for awaited slots. It now skips memos.
- The start of a load must come after the insert (a held `#loading` body that fails would report its error twice), and the early write of the settled value must come first (`countLoads` waits for the writes). `setSlots` does both.
- A name clash: `held` is already a branches export, so the read helper is `readMemo`.
- test "lets a child that the browser renders await and chain a promise prop" failed 2 of 8 runs under load (load average 17), passes alone; it passed 5 of 5 on main and on the branch alone. Not chased.

## Proposed learnings

- A render-module local that can hold a failed memo must be read through a helper; the update code reads slots, which already throw | readMemo | packages/brumate/src/codegen | no

## Verification

- Exit 0: packages/brumate (2834 tests with `--hookTimeout=120000 --maxWorkers=3`, one flake above), language-server, tsc, ui, vscode, and the examples hackernews, kit-app, nitro, todos, tracker, ui-kit; ui e2e (55 passed); oxlint (no errors in changed files); oxfmt --check on changed files; brumate typecheck.
- The three causes' pages fail with the refresh deleted and no helper (promiseParent and 3 resume tests), and pass with the helper.

## Size

- Estimated M, actual M.
- Client gzip (sum of dist/client/**/*.js, gzip -9), clean rebuilds of e95c4ab2 and the head: todos 39,352 to 39,397 B (+45; a second build of the head gave 39,419, so builds vary by about 20 B), ui 199,353 to 200,229 B (+876). Within 0.3 kB for todos.
