# Outcome: effect-copy-warning

## Built

- `checkEffectCopies` and the helpers `collectCopies` and `isPure` in `packages/brumate/src/analyze.ts`. An `$effect` whose body only assigns identifiers (maybe under `if` and blocks), where each target is a `$signal` of the component with no write at any other site, no `$bind`, no `$searchParam` and no `$optimistic`, gets one warning for each signal at the assignment: `"message" is written only by this effect. Use const message = $memo(...)`, or `Use a $memo` with an `if` that assigns on every path, or several assignments.
- Catalog entry `BRM209` in `error-catalog.ts` (the first for a warning), pinned in `test/error-codes.json`; `website/docs/errors.md` and the skill `references/errors.md` regenerated. `BRM210` is unused.
- Warnings show their code in `check-command.ts`, `packages/language-server/src/diagnostics.ts` and the dev warning in `vite.ts` (`withCode`).
- Tests: `packages/brumate/test/effect-copy-warning.test.ts` (warning, `if`, two signals, 16 quiet cases, `brumate check` record), one test in `packages/language-server/test/server.test.ts`.
- A test in `packages/brumate/test/vite.test.ts` (extra file) shows ` [BRM209]` in the dev server warning.
- Docs: `website/docs/effects.md`, `docs/decisions.md`. Changeset `.changeset/effect-copy-warning.md` (minor).

## Proof

Not a fix node.

## Deviations

- Extra files edited outside the brief list: `packages/language-server/test/server.test.ts` (code of a warning), `skills/brumate/references/errors.md` (generated), `.changeset/effect-copy-warning.md` also bumps `@brumate/language-server`.
- `++`, `--` and every compound operator end the check (the brief says "and the like"): a counter or accumulator reads itself, no memo replaces it. Review round 1 also made the check quiet when a right side or an `if` test reads an assigned name, and when a name is not assigned on every path (a one-sided `if`).
- A `let` prop or an imported signal is not a target, so the effect stays quiet.
- The dev server shows the code as ` [BRM209]` after the message, as errors do.

## Stubs left

- None.

## Gotchas

- Any warning whose text matches a catalog entry now gets its code. Other warnings match no entry, so they print as before.
- The quiet-case tests filter on the text of this warning, since an effect that reads nothing gets its own warning.

## Proposed learnings

- A new message that two texts share goes in one catalog entry with a `{placeholder}` | `matchesError` matches each part lazily | packages/brumate/src | yes

## Verification

- `pnpm lint` (warnings only, none new), `pnpm format:check`, `pnpm typecheck`, `pnpm build`: pass.
- `cd packages/brumate && npx vitest run test/effect-copy-warning.test.ts test/check-command.test.ts`: pass. `packages/language-server` tests: pass (9).
- `pnpm test` in packages/brumate: 3327 of 3328 pass. `differential-2 refLoop` timed out under load and passes alone. An earlier run under heavier load had 28 failures in 5 files, none in this node's files; the rerun was clean.
- `brumate check --no-types` in `packages/ui`, `website`, `examples`, `benchmarks`: no BRM209.
- Review round 1: `npx vitest run test/effect-copy-warning.test.ts test/check-command.test.ts test/vite.test.ts` pass (87); lint, format, typecheck rerun below.
- e2e not run: a compile warning does not change rendered output.

## Size

- Estimated S, actual S.
