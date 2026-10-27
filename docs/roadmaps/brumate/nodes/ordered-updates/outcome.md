# Outcome: ordered-updates

## Built

- A write is a pass, in `packages/brumate/src/runtime/client/updates.ts`. `trigger` calls `pass(() => queueWrite(...))`. `queueWrite` puts the updates of `g` for the slot in queues keyed by scope and update, so each waits once: `pendingMemos` (with a rank), `pendingUpdates` (bindings and block updates) and `roundEffects`.
- The outermost pass runs `drain`: the queued memo of the lowest rank first, until none waits, then the bindings that wait as one round, then memos again, until both queues are empty. Effects go to `pendingEffects` after that and run when `running` is back at 0, as before.
- The rank of a memo is the number in its name, `m<site id>`. Sites are numbered in source order and a memo is declared after the memos it reads, so it is a topological order inside a component. A wrong rank would only cost an extra compute, never a wrong value, because a memo that runs is taken out of the queue and a later write queues it again.
- The props that a round of bindings writes reach a child before its memos compute, since the memos wait for the end of the round.
- Writes made in one pass that wait for code, such as two props of a child whose update code has not loaded, join one list (`waiting`) and run as one pass when the code is there. Writes outside a pass wait as before, one pass each, with the same awaits, so their order does not change.
- Effects: the effects queued in a later round run before those of earlier rounds. That keeps the order of main, where the effects of a child ran before those of its parent (Transition relies on it: a parent leaves after its child).
- The 5 tests under "updates of a signal and a memo of it" in `packages/brumate/test/resume.test.ts` are `it` now.
- No compiler change: `g` and plan.ts are as before. The queues do the work of the transitive lists of the proposal, so the tables do not grow.

## Deviations

- None in files. plan.ts and codegen/client.ts, owned, were not needed.
- `run` is gone; `pass`, `queueWrite`, `queue` and `drain` replace it. `runUpdate` is gone.
- An update queued for a scope that left the page in the pass does not run (`scopes.get(id) === target`). Effects checked `scopes.has(id)` before, so an effect of a scope replaced under the same ID no longer runs on the old scope.
- A pass that throws drops what waits in it, as the loop of `run` did.

## Stubs left

- None.

## Gotchas

- Memos stay eager: `set` returns after the whole pass, so a handler that writes `count` and reads `double` reads the new value. Bindings run later than before inside a pass: a binding that writes a signal no longer sees the memos of that write until the next round. Nothing in the suites relies on that.
- `treeChanges` in scopes.ts has no reader now (`queueWrite` runs no update while it finds descendants). It is still counted, because resume.ts, owned by fields-typed-early, calls `treeChanged()`. A later node can remove both.
- For batching: a pass is still one write outside a pass. `pass(fn)` is the place to make a handler a pass: call the handler inside it. `waiting` is per pass and reset when the outermost pass ends.
- The order of writes that wait for code depends on the number of awaits in `trigger`. The `#offscreen` test "renders a body that is hidden at first on the client" fails if a waiting write resumes later than on main.

## Proposed learnings

- Effects of a child run before those of its parent, and parts rely on it | Transition leaves its parent after its child by effect order | packages/brumate/src/runtime/client | yes (packages/ui/test/transition.test.ts)
- A memo update is named `m<site id>`, and the runtime reads the id as its rank | the order of memos in a pass | packages/brumate/src/codegen | yes (the diamond tests)

## Verification

- The 5 tests turned to `it` failed on main first (two runs where one was expected, and `C` where `D` was expected).
- `npx vitest run` in packages/brumate: 55 files, 981 passed.
- `npx vitest run --maxWorkers=2` in packages/ui (after `npx tsdown`): 56 files, 531 passed, 5 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0, and fails on a deliberate error.
- `npx oxlint` and `npx oxfmt --check` from the root: exit 0, no new warnings in updates.ts.
- One run of the brumate suite failed `test/vite.test.ts > the serial entry` (a server-side seroval error); it passed alone and in the two other full runs.
- Not run: `pnpm bench`, `node e2e/run.mjs`, the ui typecheck.

## Size

Gzip -9, base (origin/main 3ad1bc34) then head.

- dist of `npx tsdown`: client 31717 to 32451 (+734, unminified), produce 4591 to 4591, client-routes 1841 to 1841.
- Todos app of benchmarks/brumate (`vite build`, all JS of dist/client): 27938 to 28150 (+212, budget 300). Its core chunk 9689 to 9910 (+221). The App chunk with its `g` table: 889 to 888.

Estimated L, actual M: no compiler change was needed.
