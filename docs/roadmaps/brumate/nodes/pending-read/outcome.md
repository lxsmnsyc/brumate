# Outcome: pending-read

## Built

- `pend`, `NotReady`, `memoResults` in `packages/brumate/src/runtime/client/updates.ts`; `renderMemo`/`readMemo`/`memoNow` in `runtime/client/components.ts` use them; `pend` is exported from `runtime/client.ts`.
- `callsPending` in `codegen/scopes.ts`; `pended` in `codegen/markup.ts` wraps inserts and attribute values that call a function prop or a function that reads a memo.
- Tests: four in `test/resume.test.ts` with pages `PendingRead*` in `test/render`. Patch changeset `.changeset/pending-read.md`.

## Proof

- base: fa137b5b, `npx vitest run test/resume.test.ts -t "pending memo|without signals"` in packages/brumate: 3 failed with the TypeError.
- branch: same command, 5 passed. The direct markup read test passes with the codegen change and fails without it.

## Deviations

- The brief suggested `setSlots` starting a load of a pending slot. A memo that reads a pending memo returns a promise that `pend` computes again, so `setSlots` loads it as any async memo. No new slot state.
- Pages with no signals have no update code, so the update part cannot compute the memo; the promise does it.

## Round 1

- Block headers, component props and non-promise attribute values wait through `fillPend`; a stop at a never-written slot throws; a removed scope computes nothing more; rejection reaches `#try` once. Tests in `test/pending-read.test.ts` and `test/resume.test.ts`.

## Stubs left

- None.

## Gotchas

- `get` now throws `NotReady` for a loading slot while render code runs (`reading > 0`), also through a handler prop.
- A spread value, a function in a local alias or a method of a local object that reads a pending memo is not covered; nor is a literal class object with a call condition.
- A memo that is the bare read of another memo (`$memo(user)`) now also waits through `pend`; the full suite passes.
- `ResolveGoneChild` differential fails alone on the base too (timing).

## Proposed learnings

- None.

## Verification

- See log.md. e2e website 75 passed on the second run (the first had the /ui overlays flake), browser-async 6 passed. Todos bench: 33.2 kB / 13.9 kB gzip total JS. Lint, typecheck: ok; `pnpm format:check` fails only on docs files outside this change; `pnpm test` in packages/brumate: 3274 passed, flakes listed in log.md.

## Size

- Estimated M, actual M.
