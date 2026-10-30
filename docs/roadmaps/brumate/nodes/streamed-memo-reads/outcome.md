# Outcome: streamed-memo-reads

Design: [pending-handler-reads debate](../../../../debates/pending-handler-reads/debate.md), "Settled structure" parts 1 to 5 and 7. Part 6 (promise props must go through `$memo`) is the node promise-prop-memo.

## Built

- `$resolve(memo, { timeout, signal })` in `brumate/signals` (`runtime/signals.ts`, `macros.ts`). The client helper `resolve()` in `runtime/client/updates.ts` waits until the memo and the memos it reads are not pending and no update code is loading, then reads it. It rejects with the memo's error, on timeout and on abort. A superseded load never resolves it, since the memo stays pending until the latest load settles. The server compiles it to `Promise.resolve(value)`. BRM183 (bad arguments) and BRM184 (where a memo computes or markup renders).
- BRM182 (`src/pending-reads.ts`, run from `compile.ts`): a handler, a handler prop of a component, a `$client` callback, or a same-script function they call reads a memo that can lack a value, unless `$isPending` guards it or `await $resolve(m)` comes before it. Memos of imported `'use server'` functions count as async. A memo that markup reads outside `#loading` and `#defer` (or that such a memo reads) has a value. Guards: early return/throw/continue/break (also with else), `if`, `?:`, `&&`, `||`, and `const p = $isPending(m)`.
- Runtime: a read of a slot that holds a promise the page knows is loading (`loadingValues`: streamed, browser-rendered, promise props) throws, with a message that points to `$resolve`, unless code that updates the page runs (`updating()` in `queue()`, `refresh()` and late children, which read the promise as on main). No handler counter, so reads after an `await` throw too. A promise that browser code writes into a signal is a plain value.
- Effects skip a run that reads a loading value, run again when the promise settles, and send the error to `#try` when it rejects. `$client` is a handler (`effect(…, 1)`).
- `setSlots` settles the slot of a browser-created memo from its render promise.
- Docs: async-data.md, effects.md, errors.md (both copies), signals.md of the skill, decisions.md (one entry, and the `await $memo` line corrected). Changeset: brumate minor.
- Tests: diagnostics.test.ts (BRM182 cases, `$resolve` placement), resume.test.ts (`$resolve`: settled, write then wait, inputs change mid-wait, first load, reject, timeout, abort; effect skip and rerun; handler prop; read after await; promise prop; plain promise in a signal; effect rerun on reject).

- Review round 3: `resolve()` takes the scope of the memo, keeps its waiter in `waiters` (state.ts) and rejects with an `AbortError` when `removeScope` runs. Only an `await $resolve` that always runs before the read (a statement, a declaration or an assignment at the top level of the block) guards it. A parameter hides a `const` check of the same name. `brumate check` passes server-import detection (`findServerImport`). `$resolve` takes memos only.

## Deviations

- BRM182 runs in `compile.ts`, not `analyze.ts`, because `serverImport` is known only there. `SemanticModel` gets `pendingCalls`.
- Touched `state.ts`, `insert.ts`, `children.ts`, `handlers.ts`, `codegen/rewrite.ts`, `codegen/patch.ts`, `macros.ts`, `shared-module.ts` and the skill's signals.md, as the design needs.

## Gotchas

- `docs/debates/pending-handler-reads/evidence/*.js` fail oxlint, and 22 files under `docs/debates` fail `format:check`, on main. Not touched.
- A page rendered in the browser cannot wait with `await $memo` yet (0.5.0 node `browser-await-spike`); the read throws.
- Old tests asserted that `get()` returns the streamed promise. They now assert it throws.

## Proposed learnings

- None.

## Verification

- `pnpm lint` (no errors outside docs/debates), `pnpm typecheck`, `pnpm build`: pass. `pnpm format:check` fails only on the 22 files of docs/debates that main has.
- `npx vitest run` in packages/brumate: 1199 passed. `pnpm --filter website check:samples`: 65 samples, 0 problems. A scan of every `brm` sample in website/docs finds no new BRM182 to BRM184.
- `pnpm bench --only brumate --scenario todos --metrics browser`: JS before `load` 14,876 B gzip on main (origin/main sources, same machine), 15,016 B on the branch, +140 B.

## Size

- Estimated M, actual L.
