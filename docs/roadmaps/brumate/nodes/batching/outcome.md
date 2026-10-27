# Outcome: batching

## Built

- A handler is a pass (`pass(() => handler(...))` in `client/handlers.ts`). The bindings of its writes run once, when the handler returns, in the order of ordered updates, and the effects after them. The run of waiting effects is a pass too (`flushEffects` in `client/updates.ts`).
- Memos are lazy inside a pass but read as eager: `get` of a slot computes the memos of that scope that wait (`dirty`, `settle`), so a handler that writes `count` and reads `double` reads the new value. Memos in other scopes wait for the pass to end, so no memo computes with a prop that its parent has not passed yet (the diamond tests still pass).
- `flush()`: `export function flush()` in `brumate/signals` calls the client function through `Symbol.for('brumate.flush')`. It runs the memos and bindings that wait, not the effects. Outside a pass and on the server it does nothing.
- `onPassEnd(hook)` is only in the contract, marked reserved. No code: `search-params` builds it. Frozen in `contracts/update-pass.md` (v1).
- After an `await`, each write is a pass of its own (no microtask batching, as the brief says). `flush()` there does nothing. A test pins that a write after an `await` shows at once.
- A handler that throws after a write still shows the write: `pass` drains the queue in its `finally`, and the error reaches the nearest `#try` as before.
- `call()` (function props and provided functions) runs inside a pass, so a child that calls `onPick(7)` where the parent writes two signals makes one DOM write. `references.ts` gets the pass from `updates.ts` through `setPass`, to avoid an import cycle.
- A handler waits for the update code of its scope, its parents and the scope its children render in (`updateReady`), so its writes are not held back until after it returns. This removes the race of ordered-updates (a write that waits for code against a handler whose code loads at the same time). When writes still wait for code (a component that the page renders later), the effects of the pass wait for that pass too (`held` in `pass`), so an effect never sees the DOM before the bindings of the write ran. `Tabs` relied on that.
- Compiler: an import of `brumate/signals` that also names `flush` stays as an import of `flush` only (`importSource` in `macros.ts`, used by `codegen/server.ts`; the client output already lists used names only; `analyze.ts` skips the compile-time names). A compile test in `test/codegen.test.ts` checks both outputs.
- Tests, named "batching" in `packages/brumate/test/resume.test.ts`, with fixtures `batchingWrites`, `batchingThrow`, `batchingFlush`, `batchingMemo`: one DOM write for two writes, one run of an effect that reads both, no throw between two writes, `flush()` (also with the update code loading at the same time), the DOM not yet written without `flush()`, and a handler that reads a memo of what it wrote. On main the effect, the two `flush`, the memo read and the await tests fail. The DOM-write-once tests (also with update code that loads, and through `call`), the no-throw test (with loading code) and the handler-throws test pass on main too: main already joins writes that wait for the same code, and these guard the new paths. I did not find a case where main writes twice and this branch once besides the effect and the race.

## Deviations

- Edited `packages/brumate/src/analyze.ts` and `packages/brumate/src/macros.ts`, not in the brief, so `flush` can be imported next to `$signal` from `brumate/signals`. Without it the compiler drops the whole import. Small and compiler-only.
- The audit of `@brumate/ui`: no `.brm` needed `flush()`. The ui suite passes without a change in `packages/ui`. The handlers that focus (`ComboBox`, `Checkbox`, `Select`, `Tabs`, `SliderThumb` and others) focus elements that exist before the write. The failures I hit on the way (ColorSlider, ColorArea, ColorWheel, Tabs) were handlers that read a memo after a write, or an effect that ran before the bindings, and the runtime rules above fix them.
- `contracts/update-pass.md` was a draft; it is now frozen at v1.

## Stubs left

- None. `onPassEnd` has no caller yet; `search-params` is its first user.

## Gotchas

- Do not use `git stash` in these worktrees: the stash list is shared, and another worker popped mine.
- A memo that waits is computed by the first read of any slot in its scope (`get`), in the order of its rank. A read outside a pass or while the queue drains does not do this.
- Reads in a handler of a memo of another component (for example a parent that gets a bound prop) see the old value until the pass ends or `flush()`.
- A handler now loads the update code of its scope chain (parents, owner and the scope its children render in) on its first run, even if it writes nothing. Follow-up: limit the wait to the scopes the handler can write (the compiler knows the written slots). Risk until then: a failed or slow update chunk of an ancestor delays or fails an unrelated handler (the error goes to `fail(scope)`).
- If the load of a write that waits for code rejects, its effects stay in `pendingEffects` until the next pass.
- Tests under `.git` do not run (vitest skips it); the worktree is at `.claude/worktrees/node-batching`.

## Proposed learnings

- A handler is one pass; `flush()` runs the waiting bindings | batch writes and read memos at once | packages/brumate/src/runtime/client | yes (the batching tests)
- Effects wait while writes still wait for code | an effect must not run before the bindings of its write | packages/brumate/src/runtime/client/updates.ts | yes (as-collections tabs test in packages/ui)

## Verification

- `npx vitest run` in packages/brumate: resume.test.ts 294 passed, 2 expected fail. The other files were not rerun after the final change; the first full run (before the final runtime fixes) failed only in `testing.test.ts` and `vite.test.ts`, which the orchestrator says come from the `.git` path.
- `npx vitest run --maxWorkers=2` in packages/ui (after `npx tsdown`): 537 passed, 1 expected fail.
- `npx oxlint` (warnings only), `npx oxfmt --check`, `npx tsc --noEmit -p .` in packages/brumate: pass.
- Not run: `node e2e/run.mjs`, `pnpm lint` and friends through pnpm (pnpm refuses a symlinked node_modules in a worktree).

## Size

`pnpm bench` does not run in a worktree (pnpm refuses the symlinked node_modules), so I built `benchmarks/brumate` with `vite build` and added the gzip -9 sizes of all JS in `dist`:

- todos: 28659 before, 28945 after (+286 B, within 0.3 kB), built with `vite build` of `benchmarks/brumate` and summed by hand (the harness gave 28.2 kB for head; the base worktree has no build of the app). After the review fixes I trimmed `dirty` to a set of names, shared `loadUpdate` between `updateCode` and `updateReady`, and removed the hook list.
- 10000 rows, `count++` with a memo in each row (a component with `$memo(item + count)`, happy-dom, 6 clicks, 3 runs each): first click 195-570 ms (noisy), later clicks 50-52 ms on this branch; main 191-286 ms and 51-59 ms. No slower.

Estimated M, actual M.
