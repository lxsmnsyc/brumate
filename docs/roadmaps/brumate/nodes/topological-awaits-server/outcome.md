# Outcome: topological-awaits-server

## Built

- On the server, the declaration of each `const x = await $memo(...)` moves to right after the last statement that holds it, followed by `$$b.start($$p_x);`. At the original place, `awaitRun` emits the same `ready` or `waitAll` as before, so each `await` waits where it is written. A load moves only when a statement that waits lies between: the end of an earlier run of awaits, a memo that the markup waits for (`awaitHeld`), or an `await` in the script. Other components compile as before.
- What holds a load (`findLoadStarts`, `packages/brumate/src/codegen/starts.ts`): a statement that declares a name the memo reads (TDZ), or that can change one. That covers a write (`q = x`), the root of a callee or of `delete` (`params.set()`), any name in a call argument, and a mention of a local function, which counts through all the names that the function mentions. The memo's names are followed through the local functions and plain memos that it reads. A plain read such as `let r = q` does not hold it, and neither do function declarations or the statements where `runs` is false (`$effect`, `$client`, imports, types on the server). Awaited memos of other loads are not followed. They come back in `memos`, and the caller places the load after their declaration.
- For browser-await-blocks: `findLoadStarts(statements, scope, loads, runs)` returns `{ after, memos }` for each load statement. `hasAwait(node)` is exported too. The server's placement rules (move only over a wait, after the memos it reads) sit in `Emitter.earlyLoads` in `markup.ts`.
- Runtime: `start(node)` in `src/runtime/server.ts` calls `ready` and catches both a synchronous throw and the rejection of the returned promise. The memo stays failed, so `ready` or `waitAll` at the `await` throws the error there.
- `$effect`, `$client`, imports and type declarations no longer end a run of awaits on the server (`isQuiet`).
- Docs: docs/decisions.md:27 states the new rule. website/docs/async-data.md describes the start rule, what holds a load, and that a guard such as `throw redirect()` does not hold a later independent load.
- Changeset `.changeset/await-memo-starts-early-on-server.md`, patch (changed behavior).
- Tests:
  - `test/render.test.ts`, "where the loads of awaited memos start": 5 render tests with fixtures `test/render/starts*.brm` and `startsData.ts`.
    - Overlap across a plain statement: peak 2 loads in flight, and the statement runs once, after the first settles.
    - A write and a `params.set()` hold the later loads.
    - Hoisted functions: one starts early after `let n`, one waits for `let m`, with no ReferenceError.
    - A sync throw and an early rejection surface at the `await`, after the statement before it, with no unhandled rejection.
  - `test/codegen.test.ts`:
    - `$effect`, `$client`, an import, a type and an interface keep one `waitAll`.
    - Placement after a declaration but not over a write.
    - 7 cases of what holds a load: a read, a write, a method call, `push`, an argument, a local function call, a declaration.

## Deviations

- website/docs/async-data.md is outside the owned paths. It described the old run rule, so I updated it.
- The rule is narrower than "mentions": plain reads do not hold a load. Otherwise `let q = id` held every memo of `id`.
- Two locals named `start` in server.ts were renamed (`at`, `before`), because the new export shadowed them (oxlint warning).

## Stubs left

- None.

## Gotchas

- A load with no inputs starts at the top, before earlier awaits, so the load calls change order (`['second', 'first']`). This is the rule, and the tests assert it.
- The analysis follows local names only. A call of an imported function that changes module state, or a guard (`if (!user) throw ...`), does not hold a later load that reads nothing of it. The docs say so.
- An alias of a local function held in a `const`, such as `const g = f; g()`, holds the load only because `const g = f` mentions `f`, and every mention of a function counts.
- A statement whose awaited declarators include an inline memo (a plain value) is never moved, and it holds the loads after it.

## Proposed learnings

- On the server, a moved load is idle `$$b.memo` plus `start`, and `start` must catch the throw | the start point is before the statements that the error must come after | packages/brumate/src/runtime/server.ts | yes

## Verification

- `pnpm install`, `pnpm build`, `pnpm lint` (0 errors, no new warnings in changed files), `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter brumate test`: 67 files, 2039 tests pass. The 3 devtools tests failed once under load and passed alone.
- Review: one fresh reviewer (pr-review skill) found it clean after about 45 probe compiles. There were two low notes, both on documented side-effect order. The guard caveat was added to the docs.

## Size

- Todos (`pnpm bench --only brumate --scenario todos`): JS before `load` 32.3 kB raw, 13.5 kB gzip, the same as the base. The change is server only.
- The bench's click checks FAIL on the base (793a65d9) too, not only with this change. Main's results from the same day pass. The cause is likely that bundle-urls-from-server needs `bundles`, and `benchmarks/brumate/src/server.ts` passes none. That bug is on next and feat/browser-async, not on main.
- Each moved load adds one `$$b.start($$p_x);` line to the server output. `start` is about 30 B on the server.
- Estimated S, actual S.
