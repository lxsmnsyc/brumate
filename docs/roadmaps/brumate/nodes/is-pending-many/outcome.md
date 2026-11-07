# Outcome: is-pending-many

## Built

- `$isPending(a, b, …)` takes one or more memos and is true while any of them, or a memo one reads, loads. No prior art copied: the shape is the brief's proposal (any).
- Analyzer (`packages/brumate/src/analyze.ts`) pins each named memo; `pending-reads.ts` lets a check of several memos guard a read of each (BRM182); `codegen/rewrite.ts` joins the pending checks of all arguments, deduped. The server still gives `false` (`codegen/patch.ts`, unchanged).
- Type: `$isPending(...memos: unknown[])` in `packages/brumate/src/runtime/signals.ts`.
- `$isPending(a) || $isPending(b)` already guarded BRM182 before this change. Recorded in `docs/decisions.md` with the new rule.
- BRM108 reworded to "$isPending needs async $memos as its arguments"; no new error code. A call with no argument or a non-identifier argument is BRM108.
- Docs: `website/docs/async-data.md`, `website/docs/reference-signals.md`, `website/docs/errors.md`; skill: `packages/brumate/skills/brumate/references/{state,signals,errors}.md`.
- Tests: `packages/brumate/test/diagnostics.test.ts`, `codegen.test.ts`, `error-codes.json`.
- Changeset: `.changeset/is-pending-many.md` (minor, brumate).

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- `$resolve` still takes one memo; only `$isPending` was widened.
- `differential-4 > ResolveGoneChild` failed once in a full run under load and passed alone.

## Proposed learnings

- None.

## Verification

- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass. `pnpm --filter brumate test`: 82 files, 3021 tests pass (before the added browser-output tests). After them, `pnpm lint`, `pnpm format:check` and `test/diagnostics.test.ts` pass.
- Bench not run: `packages/brumate/src/runtime/client/**` is unchanged.

## Size

- Estimated S, actual S.
