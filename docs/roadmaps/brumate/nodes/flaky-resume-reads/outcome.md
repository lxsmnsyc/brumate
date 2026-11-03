# Outcome: flaky-resume-reads

## Built

- Textarea test: a runtime bug. `countLoads` in `packages/brumate/src/runtime/client/waits.ts` now ends a wait after `updated()`, so a held body shows only after the update code of a settled memo has run. Before, the first write to a component loaded its update code, `trigger` ran the write when the load ended, and the hold ended at once when the promise settled, so the body showed with `''` in the `<textarea>` (the same for `<p>` text). The code load is quick on a quiet machine and slow under load.
- Evidence: a trace of a failing run showed the textarea with `''` and `'Ada'` 63 ms later, with the 50 ms promise long settled. A new test, "shows a settled memo of a promise prop in a textarea when its code loads late" (`startLoader({ all: 300 })`), fails before the fix with `''` and passes after. The same delay fails the promiseMemoAttr test before the fix.
- Pending-read test: a race in the test. No markup reads the memo, so nothing holds the body, and the handler sees `pending` only if the click comes within the 100 ms of the server function. With the click delayed by 400 ms, the old test fails with the CI message. The fetch stub in `packages/brumate/test/resume.test.ts` now holds the first call until the test lets it land, and the test clicks until it reads `Ada`.
- Changeset `.changeset/held-body-waits-for-updates.md` (brumate, patch).

## Result

Not an experiment node.

## Deviations

- None. `waits.ts` is under the brief's `packages/brumate/src/runtime/client/**`.
- Todos size not measured with `pnpm bench` (exclusive, 30+ min); the change adds one `updated().then(...)` and an import, a few tens of bytes.

## Stubs left

- None.

## Gotchas

- `resume.test.ts` wipes `test/.output/resume` in `beforeAll`, so two vitest runs in one worktree break each other. Load a run with CPU hogs, not with parallel runs, and pass `--hookTimeout=60000`.
- The `<p>` variant (promiseMemoAttr) had the same bug and flaked unseen in CI; the fix covers it.
- `updated()` waits for every pending update load, not only the ones of the memo, so a hold can wait a little longer while unrelated code loads.

## Proposed learnings

- A test that needs a pending state gates the call (a promise the test releases), not a server delay | a delay races the test runner's speed | packages/brumate/test | no

## Verification

- Before (rate): textarea 2 of 20 failed on a shared but quiet machine, 1 of 34 under 4 busy loops. Pending-read 0 of 50+ failed by chance; it fails every time with a 400 ms later click.
- After: 0 of 50 failed under 4 busy loops, both tests and the new one per run.
- `pnpm lint` (warnings only), `pnpm typecheck`, `pnpm build`, `pnpm --filter brumate test` (2164 passed) pass. `pnpm format:check` fails on `docs/debates/single-child-blocks/{ledger,sealed}.json`, on main already; my files pass.

## Size

- Estimated S, actual S.
