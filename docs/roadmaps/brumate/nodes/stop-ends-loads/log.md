# Log: stop-ends-loads

## 2026-11-27

- Worktree on `hotfix/stop-ends-loads` from fea5761e (main). `pnpm install`, `pnpm build` ok.
- Added `regression-test.patch` of module-memo-extra-load to `packages/brumate/test/module-signals.test.ts`. On main, `npx vitest run test/module-signals.test.ts` in `packages/brumate`: 1 failed, 60 passed (`expected 1 to be +0`).
- WIP commit with `cross-test-repro.patch`, then `RC_SLOW='resumes without a second load' npx vitest run test/module-signals.test.ts -t "an async memo of a module"` 5 times on main: 5 of 5 red (`expected 3 to be 2` and `expected 1 to be +0`). The WIP commit was dropped with `git reset --hard`.
- With the fix and the same repro: first loop 4 of 5 green (run 1 failed once, cause not captured, the first run after a cold start); a second loop 6 of 6 green.
- Other `loadModule` continuations: `branches.ts`, `errors.ts` and `insert.ts` (`refresh`) now check the stop counter. `props.ts`, `updates.ts` and `references.ts` start nothing that links a store after a stop: they wait on loads of handlers and writes, so they are unchanged.
