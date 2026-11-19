# Outcome: ref-element-writes

## Built

- Option A. `ref-loop` in packages/brumate/test/differential/data.ts is `accepted` with the reason. No runtime change.
- The probe is the resume test "stops updates that keep writing what they read, with one error, and the page goes on" in packages/brumate/test/resume.test.ts; its title now names the ref in a list.

## Proof

- base: the resume test with `refLoop` passes on the base: after "Go" the update guard reports one error with "did not settle" (BRM187). The resumed page loops like the browser render, until the guard stops it.
- branch: same test passes; differential tests pass with `ref-loop` accepted.

## Deviations

- BRM187 message unchanged. The guard cannot know cheaply that a ref write started the loop (see log.md). No changeset.

## Stubs left

- None.

## Gotchas

- Svelte 5 and Solid loop on this program too; the cause is the program, not brumate.
- The probe test existed already; it was not new.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run` on resume.test.ts (-t "keep writing") and the differential tests; lint, format:check, typecheck, brumate tests (see the commit).

## Size

- Estimated S, actual S.

Landed on batch/brumate-main as e8ba92f1. BRM187 message unchanged; a fresh review noted a DEV-only hint at throw time (scan the stuck scope for an element value) as a possible later S change.

Cut into main on 2026-11-19 (078262b1).
