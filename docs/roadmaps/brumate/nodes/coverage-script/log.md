# Log: coverage-script

- Added `@vitest/coverage-v8@5.0.5` (same as vitest 5.0.5) to packages/brumate devDependencies with pnpm. The lockfile changed only for that package and its dependencies.
- Added the `coverage` script in packages/brumate/package.json. It prints a note that the tests run with every flag on, then runs `vitest run --coverage`.
- Added `test.coverage` in packages/brumate/vitest.config.ts: provider v8, `include: ['src/runtime/**']`, reporters `text-summary` and `text`, `reportOnFailure: true`.
- First coverage run failed 48 tests with 5 s timeouts (v8 instrumentation slows `features.test.ts`, `skill.test.ts` and others). The script now passes `--testTimeout=60000 --hookTimeout=60000`.
- Two more coverage runs each failed 1 to 11 resume, stores and differential tests, a different set each time. All pass without coverage (`pnpm --filter brumate test`: 3538 passed). `reportOnFailure` keeps the report when this happens.
- `getScope` was exported by `runtime/client/scopes.ts` and re-exported by `runtime/client.ts` (`brumate/client`, a public entry). Removed both. `resume.test.ts` now reads `client.scopes.get(id)`. Patch changeset added.
- `feature-flags-off.test.ts`: `FLAGS` gained rootWait, clientHTML, loading, lateMarkup, children, templates and bindings. The facts test and the "every flag off" test (counter page) cover them. All pass, so no flag-off bug was found.
- website/docs/contributing.md does not exist. The flag note lives in the script output.
