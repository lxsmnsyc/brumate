# Outcome: indicator-timing-function

## Built

- `easing()` in `packages/ui/src/selection-indicator.ts` takes the first timing function without cutting inside parentheses.
- Test in `packages/ui/test/indicator.test.ts` with `cubic-bezier(0.2, 0, 0, 1)` and `steps(4, end)` (fixture `packages/ui/test/fixtures/indicators.brm`).
- Changeset `.changeset/indicator-timing-function.md` (patch).

## Deviations

- The fixture file `packages/ui/test/fixtures/indicators.brm` is under `packages/ui/test/**`, so inside the shared paths.
- The site rule needed no edit. The website has no SelectionIndicator demo on main (it comes with PR #362), so the Chrome check uses the example page examples/ui with the site's rule value injected. This adds a step to `e2e/suites/ui.mjs`, outside the owned paths.

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

- `node e2e/run.mjs --only ui`: the new step "Tabs: an indicator with a timing function that has commas slides" passes (the other failures in two runs, PreviewTrigger and ColorArea, are timing flakes under load, in other steps). With main's selection-indicator.ts the step fails (no animation starts, timeout). With the fix, the animation eases with `cubic-bezier(0.2, 0, 0, 1)`.
- `pnpm --filter website build`: pass.

## Size

- Estimated S, actual S.
