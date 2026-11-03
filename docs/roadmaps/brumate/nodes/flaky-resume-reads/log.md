# Log: flaky-resume-reads

## 2026-11-03

- Worktree hotfix/flaky-resume-reads from main 2a84f0c8. Found a trap for load tests: `resume.test.ts` wipes `test/.output/resume` in `beforeAll`, so parallel vitest processes in one worktree break each other (hook timeouts, missing files). Load must come from CPU hogs (`node -e` busy loops), not from parallel runs, and `--hookTimeout=60000` since the compile in `beforeAll` takes over 10 s under load.
- Textarea test, before: 2 of 20 failed with a quiet but shared machine; 1 of 34 failed under 4 busy loops (with a trace in the test). Trace of a failure: the textarea appeared with `""` and held `"Ada"` 63 ms later, with the 50 ms promise long settled.
- Cause: `trigger` in updates.ts loads the update code of a component on its first write and runs the write when the load ends. `setSlots` fills the memo slot when the promise settles, and `countLoads` then ends the hold at once, so the body shows before `u1` (`writeText`) ran. Browser render writes `''` for a promise.
- Deterministic repro: `startLoader({ all: 300 })` makes the code load after the promise settles. The new test fails before the fix with `''`. The `<p>` test (promiseMemoAttr) fails the same way with that delay, so it is the same bug and the same fix covers it.
- Fix: `countLoads` ends the wait after `updated()` (waits.ts).
- Pending-read test: the memo is created in the browser and no markup reads it, so nothing holds the body. The handler sees `pending` only if the click comes within the 100 ms of the server function. With the click delayed by 400 ms the original test fails with the CI message (`['handler','Ada']`). Test race. The fetch stub now holds the first call until the test lets it land.
- After: 0 of 50 failed, both tests plus the new one in each run, under 4 busy loops (`node -e` for 1500 s) with `--hookTimeout=60000`. Full `pnpm --filter brumate test`: 2164 passed on the final run; one earlier full run failed "fills its text between other text" (a 5 s waitFor, passes alone, 3 reruns of the file and the next full run pass), noted as an unrelated load flake.
