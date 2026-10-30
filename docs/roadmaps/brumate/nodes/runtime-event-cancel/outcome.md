# Outcome: runtime-event-cancel

## Built

- `packages/brumate/src/runtime/boot.ts`: `delegate` never makes `click` or `submit` passive, so a `prevent` written after load cancels them. The loader keeps the checks of `cancelWhen` in a private WeakMap and registers the function under the symbol `Symbol.for('brumate.cancel')`. `onEvent` walks from the target up, runs the checks of the event type, and on a true calls `preventDefault()` and runs no brumate handler. It does not stop the event.
- `packages/brumate/src/runtime/events.ts`: public `cancelWhen(element, type, check)` (entry `brumate/events`) and the type `CancelableEvent` (`click` | `submit`). It returns a cleanup.
- `packages/ui/src/SubmitGuard.brm`: uses `cancelWhen(form, 'submit', ...)` and adds no window listener.
- Tests: `packages/brumate/test/resume.test.ts` (late prevent, `cancelWhen` on a click of a child and on a submit, cleanup, plain listeners still run, scroll is a type error), fixture `packages/brumate/test/render/cancelEvents.brm`, `packages/ui/test/Button.test.ts`.
- Docs: `website/docs/markup.md` and `packages/brumate/skills/brumate/references/events.md`.
- Changesets: `.changeset/event-cancel-late.md` (brumate, minor), `.changeset/event-cancel-ui.md` (@brumate/ui, patch).

## Result

Experiment nodes only.

## Deviations

- Edited `packages/ui/src/SubmitGuard.brm` and `packages/ui/test/Button.test.ts`, outside the shared paths, as the acceptance asks Button to drop its listener.
- Edited `website/docs/markup.md` and `packages/brumate/skills/brumate/references/events.md` for the new API (there is no `events.md` in the website docs).
- Native submit listeners now also run on a cancelled submit (no `stopImmediatePropagation`), by the maintainer's decision.

## Stubs left

- None.

## Gotchas

- A check exists only after the code of its part has loaded. Capture-phase delegation matches Marko 5 and 6, which have no cancel hook, so `cancelWhen` is the hook for a part.

## Proposed learnings

- Parts cancel delegated events with `cancelWhen`, not window listeners | the document listener runs first | packages/ui | no

## Verification

- The late-prevent test and the `cancelWhen` test fail on main, pass here. Button tests pass (26). `pnpm --filter brumate test`: 1209 pass.
- todos (`node benchmarks/harness/run.mjs --only brumate --metrics dist --scenario todos`): main 79.6 kB / 28.4 kB gzip, branch 79.9 kB / 28.5 kB gzip. A page that imports `cancelWhen` adds about 0.1 kB (the function in the events chunk; the chunk is 1.7 kB gzip).
- lint (warnings in untouched files only), format:check, typecheck: pass.
- e2e `todos`: pass. e2e `ui`: one failure, ColorArea (expected hsb(210, 51%, 71%), got hsb(210, 0%, 71%)), which fails the same way with the files of main restored in this worktree.

## Size

- Estimated S, actual S.
