# Outcome: client-fixes

## Built

- packages/brumate/src/runtime/client/updates.ts: `send` calls the exported function of a handler that `handlerProp` made, through its reference, not the handler (which falls back to the closure of the render). Setters only.
- packages/brumate/src/runtime/client/references.ts: `handlerReferences` lives here now (was in handlers.ts).
- packages/brumate/src/runtime/client/errors.ts, waits.ts: `fail(scope, error, uncaught)`; with `uncaught`, `onError` hears only an error that no `#try` catches. `reportOnce` and the MemoError path of `wait` pass it.
- packages/brumate/src/codegen/template.ts: `classTokens` gives up when a static class follows a conditional one, so the order is the server's.
- packages/brumate/test/differential/data.ts: ref-setter-relay (5 pages), memo-reject (1) and class-order (1) leave `CAUSES` and `DIVERGENCES`. They now must match the server.
- .changeset/client-fixes.md (patch).

## Deviations

- The brief puts memo-reject in `failOnce`. The error also arrives through `wait` (stored MemoError) and `unreadMemo`, so the change is in `fail`, with an opt-in argument.
- The tests are the differential pages themselves; no new test file. They fail on main (7 pages).

## Stubs left

- None.

## Gotchas

- Handlers and effects that throw inside a `#try` still reach `onError` (a resume test expects it). Only memo rejections skip it.
- A class after a conditional class now takes the generic class path (a few more bytes in markup that has one).
- "gives the element of a component in as" (resume.test.ts) waits a fixed 100 ms and can fail under load.

## Proposed learnings

- None.

## Verification

- Exit 0: packages/brumate full run except two load flakes that pass alone (see log.md), and resume.test.ts whole (623); language-server, tsc, ui (772), vscode; examples hackernews, kit-app, nitro, todos, tracker, ui-kit; ui e2e (55 passed); root oxlint (0 errors); oxfmt --check; tsc --noEmit in packages/brumate.

## Size

- Estimated S, actual S.
- Client gzip (sum of dist/client/**/*.js, gzip -9), clean rebuilds of main 4d464e22 and the head: todos 39,366 to 39,361 B (-5), ui 199,369 to 199,344 B (-25).
