# Outcome: indicator-timing-function

## Built

- `easing()` in `packages/ui/src/selection-indicator.ts` takes the first timing function without cutting inside parentheses.
- Test in `packages/ui/test/indicator.test.ts` with `cubic-bezier(0.2, 0, 0, 1)` and `steps(4, end)` (fixture `packages/ui/test/fixtures/indicators.brm`).
- Changeset `.changeset/indicator-timing-function.md` (patch).

## Deviations

- The fixture file `packages/ui/test/fixtures/indicators.brm` is under `packages/ui/test/**`, so inside the shared paths.
- The site rule needed no edit. No headless Chrome run of the site: the rule's value goes through the same code the test covers.

## Stubs left

- None.

## Gotchas

- The ui and core suites are flaky under load from parallel workers; the failing files pass with `--no-file-parallelism`, and resume.test.ts passes alone.

## Proposed learnings

- None.

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass.
- indicator test fails on main (`expected 'cubic-bezier(0.2'`), passes on the branch.
- `pnpm build`: pass. `pnpm test`: one flaky failure in brumate resume.test.ts under load, passes alone; ui failures under load pass serially.

## Size

- Estimated S, actual S.
