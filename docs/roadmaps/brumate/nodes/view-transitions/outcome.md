# Outcome: view-transitions

## Built

- `viewTransition="card"` and `viewTransitionName=(expr)`, typed on every element in `packages/brumate/elements.d.ts`. The emit writes them as `b-vt` and `b-vtn` (`viewTransitionAttributes` in `src/codegen/markup.ts`), so the HTML has no `view-transition-*` style.
- `packages/brumate/src/runtime/view-transitions.ts` exports `startTransition(update, types)`. `transition()` in `events.ts` and the navigation `transition` in `navigate.ts` both call it. With the flag, it names the marked elements in view before the transition, names those that the update added, and removes all names when `finished` settles, also on a skip or a throw. An element with no `viewTransitionName` gets `<class>-<n>` from a `WeakMap` counter. A taken name is skipped, with a warning in development.
- Build flag `viewTransitions` (`plan.viewTransitions`, `src/features.ts`, `__BRUMATE_HAS_VIEW_TRANSITIONS__`, `runtime/features.ts`).
- `examples/view-transitions` and `e2e/suites/transitions.mjs` (`node e2e/run.mjs --only transitions`).
- Tests: `packages/brumate/test/view-transitions/` (compile and render, the helper, the build flag).
- Docs: `website/docs/navigation.md` (Marking elements), `website/docs/markup.md`, `docs/decisions.md`, `e2e/README.md`, changeset `.changeset/view-transitions.md` (minor).

## Proof

Not a fix node.

## Result

Not an experiment.

## Deviations

- `website/docs/events.md` does not exist. The `transition()` docs are in `website/docs/markup.md`, which was edited instead.
- Files outside the owned and shared paths: `packages/brumate/src/plan.ts` (the `viewTransitions` field), `examples/view-transitions/**` (the e2e app), `pnpm-lock.yaml` (the new example), `packages/brumate/test/.output` is untracked output only.
- `viewTransition` and `viewTransitionName` in a spread are not renamed.
- No error code used.

## Stubs left

- None.

## Gotchas

- `navigate.ts` changed in two lines (an import and the call). When style-files' stylesheet wait lands inside the swap callback, `startTransition(update, [type])` takes it as `update` unchanged.
- The naming code reads layout (`getBoundingClientRect`) on marked elements before each transition.
- An element out of view when the transition starts is not named, so it has no old image; one that scrolls in during the update is named only in the new state.

## Proposed learnings

- A runtime helper that a feature flag cuts must keep its no-feature path the same call as before | a wrapper with an extra check added 5 B gzip to todos | packages/brumate/src/runtime | no

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: no lint error (existing warnings only), format and typecheck pass.
- `pnpm --filter brumate exec vitest run test/view-transitions`: 10 tests pass.
- `node e2e/run.mjs --only transitions`: 7 steps pass.
- `pnpm --filter website check:samples`: 71 samples, 0 problems.
- Full: `pnpm build && pnpm test && node e2e/run.mjs`: unit tests pass (one fake of test/navigate.test.ts got `finished`); e2e all suites pass; one website step failed in the full run under load and the website suite passed alone (75 of 75).

## Size

- Estimated M, actual M. The helper, the flag and the example were as planned; the e2e app was the extra file set.
- todos, JS before `load`: 14683 B gzip on `batch/brumate-release-0.9`, 14679 B on the branch (-4 B). Client JS emitted in dist: 31166 B before, 31157 B after.

Landed on batch/brumate-release-0.9 as 6246e057.

Cut into release/0.9 on 2026-11-19 (6246e057).
