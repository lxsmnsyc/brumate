# Outcome: memo-guard

## Built

- `$gate(value, (prev, next) => boolean)`: a compile-time function in `packages/brumate/src/runtime/signals.ts`, listed in `macros.ts`. The analyzer (`analyze.ts`) declares a memo for the value (site `memo`, as `$memo`) and keeps the guard as a second site of kind `function` on `declaration.gate` (`model.ts`). The guard has no graph node, so it is not tracked.
- `codegen/patch.ts` treats `$gate` like `$memo` (the guard is cut from the server and render output, which take the first value). `codegen/client.ts` emits `$$b.gate($$s, slot, guard, () => value)` for the update code.
- `gate()` in `runtime/client/updates.ts` (exported from `runtime/client.ts`) calls `memo` with a compute that gives back the old value when the guard returns false, so the existing `Object.is` check skips the write and the readers. The first value passes (no value in the slot, or a held `MemoError`).
- Errors: BRM202 (not a value and a function), BRM203 (the value awaits or calls a server function), BRM204 (misplaced `$gate`). `$gate` reuses BRM089 for `let` and the destructure message.
- Docs: decisions.md entry; website/docs/state.md (section next to `$memo`), reference-signals.md, errors.md (generated); the skill references (signals.md, state.md, errors.md). Changeset `.changeset/memo-guard-gate.md` (minor).
- Tests: `$gate` in packages/brumate/test/resume.test.ts (first value without guard, held value and no reader runs, new array with same items after resume, guard that reads a signal and calls a function in a browser-rendered block, throwing guard reaches `#try`); `$gate` in test/diagnostics.test.ts (BRM202, BRM203); fixtures `test/render/gate{Query,Reads,Throw}.brm`.

## Deviations

- Also edited `docs/decisions.md` and the skill files (`packages/brumate/skills/**`, which a catalog test pins to the error catalog), `test/error-codes.json` and `test/diagnostics.test.ts`. `analyze.ts` and `model.ts` hold the declaration; `model.ts` is not in the brief's shared list.
- The brief cites the outcome of memo-errors-at-read, which has no folder. Rule 5 follows decisions.md (a throwing memo holds its error, and each read throws), which `hold()` does today.
- Rule 2 on the server needed no code: server and render output take the value. Since render-memos, a memo that nothing reads has no server value; the first browser compute then passes without the guard (`slot in scope.s`).
- BRM203 catches an `await` and a server function call (where the analyzer already makes an `async-memo`), not a local `async` function call, as for any memo.

## Stubs left

- None.

## Gotchas

- The guard is not tracked: a signal that only the guard reads does not run the memo again. Documented.
- `pnpm test` stops at the first failing package; use `pnpm -r --no-bail test`. The catalog test (`skill.test.ts`) needs each new message in the catalog and `UPDATE_SKILL=1 npx vitest run test/skill.test.ts test/check-command.test.ts` to regenerate errors.md.
- `resume.test.ts > stops updates that keep writing what they read` failed once in a full `pnpm test` run (guard-free test). It passed alone three times, in its whole file, and in a second full run.

## Proposed learnings

- A compile-time function with extra arguments keeps the first as the memo site and puts the rest in a `function` site with no graph node | the memo paths of the server, render and graph stay unchanged | packages/brumate/src | no

## Verification

- `pnpm lint` exit 0 (warnings only), `pnpm format:check` pass, `pnpm --workspace-concurrency=2 -r typecheck` exit 0.
- `pnpm -r --no-bail test`: exit 0 (brumate 2969, ui 783 + 1 expected fail, website 336, the other packages and examples pass).
- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "gate"`: pass.

## Size

- `pnpm bench --only brumate --scenario todos`, both refs rebuilt clean: JS before `load` 13.8 kB gzip -> 13.8 kB; client JS emitted 27.7 kB -> 27.7 kB; the sum of gzip -9 of every JS file in the todos dist 91486 B -> 91486 B. The app pays nothing because `gate` is not imported.
- The unshaken package chunk `dist/client-*.js` (all of the client runtime): 48000 B -> 48157 B gzip (+157 B), runtime/client.js 1473 -> 1474 B. This is above 0.1 kB when counted as the whole chunk, and 0 for any app that does not call `$gate`.
- Estimated M, actual M.

## For the maintainer

- The acceptance says the eager core grows by at most 0.1 kB. Counted as the whole unshaken chunk it is +157 B gzip, since `gate` is a new export; no built app that does not use `$gate` changes. Decide whether the measure is the app or the chunk.
- The guard is untracked by choice (rule 2: it runs only on changes). Tracking it would make a changed `min` rerun the memo.
