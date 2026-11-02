# Log: try-first-error

- 2026-11-02: Branch fix/try-first-error from origin/main 7971bad0.
- Added fixtures `tryTwoEffects` (copied from feat/browser-async) and `tryTwoRows` (two `#for` rows whose effects throw in one update; main has no browser-rendered `await`, so effects stand in for the story's failing loads). Test `two errors of one #try body at once` in resume.test.ts.
- On main both tests fail: the `#catch` shows once, with the last error (`second 1`, `row 2 1`).
- Applied the story's errors.ts change as is: both tests still fail. On the story, `catchInto` is sync (eager client code). On main it awaits `loadPart(module, 'update')`, so both errors pass the check before the first one replaces the body.
- Moved the check into `catchInto`, after the `loadPart` await. Both errors wait on the same cached promises, so the first replaces the body and the second sees its body gone. Both tests pass.
- Changeset `.changeset/try-first-error.md` (patch), a different name from the story's `try-shows-first-error.md`.
- build, lint, format:check, typecheck, brumate test (1400) pass.
- Bench `pnpm bench --only brumate --scenario todos`: JS before `load` 14.9 kB gzip, same as main; click waits passed.
- Draft PR #431. Review round 1 (fresh reviewer, pr-review): reproduced on main, proved the fix and the revert, checks pass. Clean; two nits: no test for an error whose body left for another reason (`#if` toggle), and this log was untracked.
