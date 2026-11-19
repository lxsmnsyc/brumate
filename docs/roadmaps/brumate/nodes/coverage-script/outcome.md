# Outcome: coverage-script

## Built

- `pnpm --filter brumate coverage` (packages/brumate/package.json) runs the unit suite with `@vitest/coverage-v8@5.0.5` and prints coverage of `src/runtime/**` (config in packages/brumate/vitest.config.ts). It first prints that the tests run with every feature flag on and that a flag's off path runs only in `feature-flags-off.test.ts` and e2e.
- CI is unchanged: the workflows run `pnpm test`, which does not collect coverage.
- `feature-flags-off.test.ts` also turns off rootWait, clientHTML, loading, lateMarkup, children, templates and bindings. The facts test and the page with every flag off pass.
- `getScope` is removed from `runtime/client/scopes.ts` and `runtime/client.ts`. `resume.test.ts` uses `client.scopes.get(id)`. Patch changeset `.changeset/remove-get-scope.md`, since `brumate/client` is a public entry.

## Proof

Not a fix node.

## Deviations

- The brief lists `website/docs/contributing.md` as shared. The file does not exist, so the flag note is in the script output only.
- The script sets `--testTimeout=60000 --hookTimeout=60000`, because v8 instrumentation made 48 tests time out at 5 s.

## Stubs left

- None.

## Gotchas

- Measured over all of `src/runtime/**` (1 coverage run, 3538 tests, flags on): statements 89.93% (10914 of 12135), branches 83.3% (6946 of 8338), functions 88.95%, lines 90.1%. The client audit's 94.5% and 87.5% covered only `runtime/client/**`, `client.ts` and `loader.ts`, so the numbers do not compare.
- Under coverage, 1 to 11 tests fail per run, a different set each time (resume, stores, differential), from timing. Without coverage all 3538 pass. `reportOnFailure` still prints the report. Do not chase these.
- Run `pnpm --filter brumate build` first in a fresh worktree.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate test`: 123 files, 3538 passed (with the new flags off).
- `pnpm --filter brumate coverage`: runs, prints the report above.
- `pnpm lint`: no errors (warnings only). `pnpm format:check`: pass. `pnpm typecheck`: pass.

## Size

- Estimated S, actual S.
