# Outcome: browser-try

## Built

- `attempt(body)` in packages/brumate/src/runtime/client/waits.ts, exported from `brumate/client`. It owns a `bound` boundary for the body of a `#try` that the browser renders. The boundary counts as one wait of the boundary around it. `done` gives the held work and leaves the outer boundary. `f` drops the held work, turns itself into a no-op, and leaves the outer boundary. Outside a boundary, the body fills in place.
- packages/brumate/src/codegen/markup.ts, `case 'try'`: in client mode, a `#try` with a `t` entry (anchored and `tryCatchesClient`) renders its body as a body function under `$$b.nodes($$b.attempt(fn))`, inside the same inline `try`, so a sync throw still reaches the inline `catch`.
- `fail` in packages/brumate/src/runtime/client/errors.ts drops an error whose `#try` body scope left `scopes` before the catch: the `#catch` or a `reset` replaced that body. So two errors at once show the first, as on the server. `onError` still sees the dropped error.
- Tests in packages/brumate/test/resume.test.ts, `describe('a #try that the browser renders around a wait')`, 11 tests:
  - a rejected `await $memo` in the body, then `reset`
  - a throw in the rest after the wait, then `reset`
  - a rejection and a throw in a child component
  - a `#try` in a component that the browser renders
  - a `#for` row, also a row added later
  - a `#loading` inside the `#try`
  - a `#try` inside a `#loading` body
  - two rows that fail at once
  - two effects of the body that throw in one update
  - nested `#try`: the innermost catches, and `reset` works
- Fixtures: `tryWait`, `TryWaitKid`, `tryWaitKidHost`, `TryWaitSelf`, `tryWaitSelfHost`, `tryWaitRows`, `tryWaitLoading`, `tryWaitInLoading`, `tryWaitNested` and `tryTwoEffects`, all `.brm` in packages/brumate/test/render/.
- Changeset `.changeset/try-shows-first-error.md` (patch). It covers only the first-error fix, which changes released behavior. The `#loading` case is unreleased story code.

## Deviations

- The brief's premise no longer held. The `t` entry exists for a `#try` with client code (try-around-child, try-template-call-site), and browser-await-blocks split `#try` bodies. 8 of the 11 tests pass on the base and serve as regression cover. Two cases failed:
  - A `#try` inside a `#loading` body. The `#loading`'s `f` kept the fallback and destroyed the body, and the error was lost.
  - Two failures of one body at once. The `#catch` rendered twice, and the last error stayed.
- The contract says "browser-try sets `f` to show its `#catch`". Here `f` only absorbs the failure, and `fail` still renders the `#catch` through the `t` entry. See contracts/client-pending-boundary.change-request.md.
- Story rule: the body adds no slot state. `attempt` reuses the existing `Boundary` (`bound`, `join`, `give`) and adds no hold-back helper of its own.

## Stubs left

- None.

## Gotchas

- macOS file names ignore case: `tryWaitKid.brm` and `TryWaitKid.brm` are one file.
- An inner `#try` in the rest of an outer wait starts its load only after the outer load settles.
- Not tested: fail, then `reset`, then fail again; a sync throw in a body inside a `#loading` or a root hold; one wait that fails while another settles later. The review traced these as correct.

## New bugs

- On main: two errors of one `#try` body in the same turn, such as two effects that throw in one update, render the `#catch` twice, and the last error stays (`fail` is async). The fix here (`fail` and test `tryTwoEffects`) applies to main as is. It could ship as its own fix branched from main.

## Verification

- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm --filter brumate test` (2119; resume.test.ts rerun alone after a load flake).
- Reverting errors.ts fails the two at-once tests. Reverting markup.ts fails the `#try` inside `#loading` test. Both checked by the reviewer.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 13,835 B gzip (13.5 kB), click checks pass.

## Size

- Estimated S, actual S.
