# Outcome: rest-ref-test-wait

## Built

- The two rest-props ref tests in packages/brumate/test/resume.test.ts wait with the file's `waitFor` for `.seen` to be `BUTTON`, not 300 ms.

## Proof

- base: the tests assert once after `setTimeout(300)`; under load the first module load misses it (`expected '' to be 'BUTTON'`, release-0.7 outcome). Not looped to reproduce.
- branch: the same tests retry for up to 5 s; `vitest run test/resume.test.ts -t "rest props"` passes 18 tests.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- The 100 ms waits in the same describe are absence checks after a `waitFor` and were left.
- `pnpm format:check` fails on docs/roadmaps/brumate/nodes/editor-sizes/brief.md, which this node does not touch.

## Proposed learnings

- Wait with `waitFor` for the expected value, never a fixed delay before a positive assertion | fixed delays flake under load | packages/brumate/test | no

## Verification

- Targeted tests: pass (18).
- Full brumate vitest (`--maxWorkers=2`): 81 of 82 files passed; test/vite.test.ts failed 4 tests on a stale dist (`brumate/hot` unresolved), and passed 33 of 33 alone after `pnpm build`. resume.test.ts passed.
- `pnpm format:check`: only docs/roadmaps/brumate/nodes/editor-sizes/brief.md (another node), not touched here.
- `pnpm exec oxlint`: warnings only, no errors.

## Size

- Estimated S, actual S.
