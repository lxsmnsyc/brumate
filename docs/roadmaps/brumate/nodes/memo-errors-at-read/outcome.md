# Outcome: memo-errors-at-read

## Built

- A memo that throws, or whose promise rejects, holds the error in the browser. In `packages/brumate/src/runtime/client/updates.ts`, `hold(scope, slot, key, error)` writes a `MemoError` to the slot of the memo (it also ends the memo's pending state and drops its guess). `get` throws the error of a `MemoError`, so every read goes through it: an insert, a binding, another memo (which then holds the same error), an effect, a handler. The error reaches the `#try` around the reader through the existing `fail` of the update, effect or handler.
- `memo()` catches a throw of its compute (not `NotReady`) and holds it after the compute ends. `asyncMemo` holds the error of the latest load in place of calling `fail` and keeping the old value. A compute without a throw writes the value over the held error as usual.
- The error rule of the pass is gone. The `failed` flag no longer stops the pass on an error: every update runs, and the ones that read the failed memo throw into their own `#try`. `failed` stays only to stop the rest of a pass after the 10000-round limit (`stuck`).
- A memo that nothing reads (no update in `g` reads its slot) logs a `console.warn` in DEV.
- `tryCatchesClient` in `packages/brumate/src/graph.ts` is also true when a `#try` body reads a memo, so the `#try` ships its `#catch` body to the browser. Before, a `#try` with only inserts of a memo had no entry in the `t` table, and the error was only logged.
- Server: `read` in `server.ts` already held the error (state `failed`) and threw at each read, so no change there. A memo declared inside the `#try` that reads it renders the `#catch` on the server (test below).
- Tests, in `packages/brumate/test/resume.test.ts`, all named "holds the memo error until a read: ...", with fixtures `memoErrorEffect`, `memoErrorSplit`, `memoErrorHandler`, `memoErrorRecover`, `memoErrorAsync`, `memoErrorServer` in `test/render/`: an effect in a `#try` that reads `count` and the failed memo throws and never runs with the old value; in one write the `#if` that reads `count` updates while the insert that reads the memo shows its `#catch`; the `#try` catches when the write waited for the code (`tryWaitingUpdate.brm`, kept); a handler that writes goes on and one that reads the memo throws into its `#try`; the memo holds the value again after a compute without a throw; a rejected async memo throws at its read; the server render shows the `#catch`. Five of the seven fail on main (effect, split, handler, recover, async); the wait test and the server test already passed on main.
- Replaced `memoThrows` ("drops the rest of the updates") and `memoThrowsTry` tests of ordered-updates, and deleted their fixtures `memoThrows.brm` and `memoThrowsTry.brm`, since the rule they tested no longer exists.
- Docs: `docs/decisions.md` has the rule, `website/docs/effects.md` (errors section) and `website/docs/async-data.md` describe it. Changeset `.changeset/memo-errors-at-read.md` (brumate, patch).

## Deviations

- Edited `packages/brumate/src/graph.ts` (`tryCatchesClient`), which the brief does not list. Without it the `#catch` of a `#try` that only reads a memo never ships, so the main acceptance case (an insert that reads the failed memo) could not work. The change is small and compiler-only.
- Deleted `memoThrows.brm` and `memoThrowsTry.brm`, fixtures of ordered-updates in `test/render/`.
- Server limitation, not fixed: a memo declared outside the `#try` that reads it still fails at its declaration on the server, because the server codegen reads the memo into a `const` there (`awaitRun` and `memoValue` in `codegen/markup.ts`, outside the owned paths). The `#catch` renders only when the memo is declared inside the `#try`. The docs say so. A fix needs reads of memos on the server to go through `read()` in place (or a lazy declaration), which is a codegen change; the orchestrator should decide whether to make it a node.

## Stubs left

- None.

## Gotchas

- A `MemoError` lives in the slot, so code that reads `scope.s[slot]` directly sees the wrapper. Reads go through `get`; `resume.ts` and `guesses.ts` read raw slots (for resumed or guessed values, where a memo does not hold an error yet).
- The held error is the same object for each reader, so `onError` and the devtools see it once for each reader that throws.
- A binding or insert outside every `#try` that reads the failed memo logs the error and dispatches `brumate:error`, once for each reader.
- The warning for an unread memo is `console.warn`, so tests that spy on `console.error` do not see it. A memo read only by a handler counts as unread (handlers are not in `g`).
- The server `Memo` already worked this way; do not add an error rule there.

## Proposed learnings

- The slot of a memo can hold a `MemoError`, and every read goes through `get` | a raw read of `scope.s` sees the wrapper | packages/brumate/src/runtime/client | no
- A `#try` ships its `#catch` body when its body holds client code or reads a memo (`tryCatchesClient`) | without an entry in the `t` table an error is only logged | packages/brumate/src | yes (the memo error tests)

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "memo error"`: 7 passed. Without the fix (`updates.ts` and `graph.ts` from main): 5 failed, 2 passed.
- `npx vitest run` in packages/brumate: 55 files, 1014 passed, 1 expected fail. `npx vitest run --maxWorkers=2` in packages/ui: 57 files, 536 passed, 2 expected fail.
- `pnpm lint` (warnings only, none new in the files touched), `pnpm format:check`, `pnpm typecheck` (after `pnpm build`): pass.
- Not run: `node e2e/run.mjs` and the full check, as the task asked for the fast check only.

## Size

- `pnpm bench --only brumate --scenario todos --metrics dist`, all JS of dist/client, gzip: 28180 before, 28222 after (+42 B, within 0.3 kB). The `failed` rule removed from the pass paid for part of `MemoError`, `hold` and the DEV warning.
- Estimated M, actual M: the compiler change for the `#try` table and the server limitation were not in the brief.
