# Outcome: prune-lazy-parts

## Built

- Removed `loadPart`, `parts`, `loadedParts`, `getPart`, `Part`, `ClientModule.load`, `CoreOptions.loadPart`, `updateReady`, `loadUpdate`, `updateCode`, `ClientModule.w`, boot.ts `partLoads`, and the `loaders` field of the compile result and `ClientOutput`.
- The compiler no longer emits `export const w`. `writesOwn`, `OUTER`, the `wide` list and `getPartName` went with it, since only `w` used them.
- Call sites (branches, errors, insert, references, rpc, resume `forget`, updates `queueWrite`, `loadedFunction`) read the module itself. The fast path of `trigger` is `modules.has(id)`; the slow path awaits `loadModule`, `loadingCode` and `childrenReady`, then one pass.
- `codeReady`, `loadingCode`, `loadingUpdates` and `childrenReady` stay.
- Tests: fixtures no longer fake `load`. The `a handler waits only for` suite became `a handler waits for the module of`: the three timing tests of the update part are gone, the four that fail or delay a module stay. Five snapshots lose their `w` line.
- Changeset: patch.

## Deviations

- updates.ts (a second change, after review): effects now wait for writes that wait for code. `pass` flushes effects only when `loadingUpdates` is empty, and the end of a waiting write flushes them. Cause of the `ui` e2e failure `Tabs: Tab stops at the selected tab, and the arrow keys select`: the keydown handler of Tabs wrote `selectedKey`, which scheduled the effect that calls `check()` (it resets the key to the first tab when no tab shows `aria-selected`). The writes to the Tab scopes waited for their children. The `onFocus` handlers of the tabs ended a pass meanwhile and flushed the held effect, so `check()` saw Mercury deselected and Venus not yet selected, and wrote Mercury back. `updateReady` slowed the handlers enough to hide the race on next. The fix also covers the same race for other effects.
- The props.ts change (`fail(child, error)` for a failed child module) is not in this PR; it is a bug of main with its own fix. The two tests that needed it (`a rejected load reaches the #try and the effects run`, `a rejected load of a write that joins a pass reaches onError`) are removed from this PR and have to come back with that fix. The remaining tests of `a handler waits for the module of` pass without it.
- Also edited: compile.ts (`loaders`), client/handlers.ts, client.ts, rpc.ts, insert.ts, errors.ts, branches.ts, references.ts, docs/roadmaps/brumate/contracts/client-modules.md (drops `loadPart`), and the test fixtures handlerWaitIdle, handlerWaitChild, handlerWaitJoin and HandlerWaitKidOk (no test uses them any more).
- No unit test fails before the fix: the race needs a browser. In jsdom, a write that waits for children resolves in microtasks, and four attempts (children passed to a child, a late component, two events in one task) never put a second handler pass in that window. A script that runs the Tabs step 25 times against the built example-ui failed 4 of 10 runs before the fix and passed 25 of 25 after. The ui e2e suite is the test.

## Stubs left

None.

## Gotchas

- Likely conflict with main: updates.ts. main has the context writer loop fix (#402) near `trigger`/`queueWrite`; this branch edits `trigger`, `queueWrite`, and deletes `updateCode`/`loadUpdate`/`updateReady` next to them.
- resume.test.ts times out 5 s tests when lint, typecheck or other suites run at the same time. Run it alone.
- A fresh worktree needs `pnpm --filter` builds of brumate, @brumate/tsc, @brumate/language-core and @brumate/language-server before `pnpm typecheck` passes.

## Proposed learnings

- `updateReady` made handlers wait for update parts that no build ever splits. If lazy parts return, bring them back as a build option, not as always-on code.

## Verification

- `pnpm lint` 0 errors, `pnpm format:check` clean, `pnpm typecheck` clean.
- `cd packages/brumate && npx vitest run`: 1285 passed.
- `pnpm build` passes; e2e: see the PR.
- No `loadPart`, `parts`, `loadedParts`, `getPart`, `ClientModule.load`, `updateReady` or `w` remain in packages/brumate/src.

## Size

`pnpm bench --only brumate --scenario todos --metrics dist` (client JS emitted in dist, run alone):

- next (574e7b8d): 81.4 kB min / 28.9 kB gzip
- this branch: 80.5 kB min / 28.6 kB gzip
- change: -0.9 kB min, -0.3 kB gzip (within the expectation of about -0.3 kB)
