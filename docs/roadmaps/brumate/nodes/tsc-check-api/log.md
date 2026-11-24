# Log: tsc-check-api

- Read `run()` in `packages/tsc`: it patches `tsc.js` with Volar `runTsc`, which prints and exits.
- Chose the TypeScript API with `proxyCreateProgram` over patching `tsc.js`. The first try gave TS6054 for `.brm` roots. `allowNonTsExtensions` fixed it.
- On the fixture, `checkProject` finds the same 37 TypeScript errors as `brumate-tsc`, in the same order, plus 2 BRM syntax errors.
- Replaced the spawn in `check-command.ts` with a dynamic import. Rewrote the failure tests around a stub module.
- Checks: lint (0 errors), format:check, typecheck (workspace concurrency 1), check-command test (30 passed), tsc tests (5 passed).
- Root `pnpm test` runs the packages in parallel. Render and differential tests of brumate failed in two runs, with different tests each time, and none of them touch the changed files. `npx vitest run` in packages/brumate alone had no failure.
