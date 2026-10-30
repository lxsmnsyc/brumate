# Outcome: runtime-event-cancel

## Built

- `packages/brumate/src/runtime/boot.ts`: `delegate` never makes `click` or `submit` passive, so a `prevent` written after load cancels them. The document always listens to `submit`. `onEvent` first runs the functions in the set `bCancels` of the event target; one that returns true ends the event before any handler.
- `packages/ui/src/SubmitGuard.brm`: the guard adds itself to `bCancels` of its form instead of a capture `submit` listener on the window.
- Tests: `packages/brumate/test/resume.test.ts` (late prevent, `bCancels`, flags), fixture `packages/brumate/test/render/cancelEvents.brm`, `packages/ui/test/Button.test.ts` (guards counted in `bCancels`).
- Changeset `.changeset/event-cancel-late.md` (patch).

## Result

Experiment nodes only.

## Deviations

- Edited `packages/ui/src/SubmitGuard.brm` and `packages/ui/test/Button.test.ts`, outside the shared paths, as the acceptance asks Button to drop its listener.
- `bCancels` is a new expando on elements. Native submit listeners now also run on a cancelled submit.

## Stubs left

- None.

## Gotchas

- A cancel function must be added on load; it runs only once the core and the part are loaded.

## Proposed learnings

- Parts cancel delegated events through `bCancels`, not window listeners | the document listener runs first | packages/ui | no

## Verification

- Three new tests fail on main, pass here. Button tests pass (26).
- todos gzip: 28.4 kB on main and on the branch (raw 79.6 to 79.7 kB).
- lint, format:check: pass (warnings only in untouched files). Typecheck: see PR.

## Size

- Estimated S, actual S.
