# Outcome: prune-lazy-parts

## Built

- Removed `loadPart`, `parts`, `loadedParts`, `getPart`, `Part`, `ClientModule.load`, `CoreOptions.loadPart`, `updateReady`, `loadUpdate`, `updateCode`, `ClientModule.w`, boot.ts `partLoads`, and the `loaders` field of the compile result and `ClientOutput`.
- The compiler no longer emits `export const w`. `writesOwn`, `OUTER`, the `wide` list and `getPartName` went with it, since only `w` used them.
- Call sites (branches, errors, insert, references, rpc, resume `forget`, updates `queueWrite`, `loadedFunction`) read the module itself. The fast path of `trigger` is `modules.has(id)`; the slow path awaits `loadModule`, `loadingCode` and `childrenReady`, then one pass.
- `codeReady`, `loadingCode`, `loadingUpdates` and `childrenReady` stay.
- Tests: fixtures no longer fake `load`. The `a handler waits only for` suite became `a handler waits for the module of`: the three timing tests of the update part are gone, the four that fail or delay a module stay. Five snapshots lose their `w` line.
- Changeset: patch.

## Deviations

- props.ts (not in the brief): a write of a prop to a child whose module fails to load had no `catch`, so the error was unhandled and no `#try` caught it. It now calls `fail(child, error)`. Without it the acceptance item "a failed module load reaches `fail` and the nearest `#catch`" does not hold for a failed child module (the old tests failed only the update part, never the module).
- Also edited: compile.ts (`loaders`), client/handlers.ts (`updateReady` call), client.ts (exports), rpc.ts, and the test snapshots.

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
