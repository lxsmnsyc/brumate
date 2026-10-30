# Outcome: streamed-memo-reads

## Built

- `get()` in `packages/brumate/src/runtime/client/updates.ts`: a slot that holds a promise never reads as the promise. In a memo or an effect it throws `NotReady`; elsewhere (handlers, `$client` callbacks) it returns `undefined`. `effect()` catches `NotReady` and skips the run; the settle of the slot runs the effect again.
- `setSlots` in `packages/brumate/src/runtime/client/components.ts`: the promise that a browser render puts in a slot now settles the slot when it lands, if no memo took it over. Before, a memo that no markup reads and no change had computed kept the promise forever.
- Tests in `packages/brumate/test/resume.test.ts` (fixtures `streamedMemoReads.brm`, `streamedMemoBrowser.brm`, `StreamedMemoChild.brm`): effect, handler, and browser-created memo. The two old assertions that `get()` returns a `Promise` now expect `undefined` and `pending` true.
- Docs: `website/docs/effects.md` and `website/docs/async-data.md` ("Reads while a memo is pending").
- Changeset `.changeset/streamed-memo-reads.md` (brumate, patch).

## Deviations

- Edited `packages/brumate/src/runtime/client/components.ts`, which the brief does not list. The browser-created case needed it (the slot never left the promise otherwise).
- Handlers get `undefined` while no value exists, and the last settled value after (a recomputing memo keeps its old value in the slot).

## Stubs left

- None.

## Gotchas

- Any slot that holds a promise now reads as pending outside a memo, as it already did inside one. A promise passed as a prop and read in a handler gives `undefined`.
- A skipped effect has already run its previous cleanup.
- The full `vitest run` of packages/brumate fails different tests on each run under load (render/resume file-level, devtools, inspect, "waits only for the update code", which also flakes on base). Each passes alone.

## Proposed learnings

- None.

## Verification

- All new tests fail on base without the fix and pass with it.
- `pnpm lint && pnpm format:check && pnpm typecheck` pass (after `pnpm build`).
- `vitest run test/resume.test.ts`: 351 passed. render, devtools, inspect pass alone.
- `pnpm bench` not run.

## Size

- Estimated M, actual M.
