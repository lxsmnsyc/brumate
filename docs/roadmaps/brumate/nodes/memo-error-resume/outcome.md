# Outcome: memo-error-resume

## Built

- A memo that failed on the server is a `MemoError` in the page state. `stateValue` in `packages/brumate/src/runtime/server.ts` gives it in place of a rejected promise, and for a memo that loads it gives a promise that resolves to one. The stream does not fail and has no extra chunk. After resume, each read in the browser throws the error to the nearest `#try`, a handler or an effect included. A compute that succeeds later holds the value again.
- `MemoError` is in `packages/brumate/src/runtime/shared.ts` now, with `stateValues.x`. The plugin `brumate/memo-error` is in `serial.ts` and writes `$b.x(<error>)`.
- What the page carries: in development (`RenderOptions.dev`), the error as seroval writes it: name, message, own properties, `cause` and the `errors` of an `AggregateError`, and no stack (the serial options already leave stacks out). In production, a new `Error` with the message of a `ServerError` (the app chose to show it), or else "The page could not compute a value", and the server logs the real error with `console.error`. This is the rule of server function calls (`errorAnswer`), so details stay on the server.
- Tests in `packages/brumate/test/resume.test.ts` ("holds the server error after resume"), with fixtures `memoErrorResume.brm` and `memoErrorResumeShown.brm`: production (generic message, no stack in the state, nothing left to stream, one log), development, and a `ServerError`.
- Changeset `.changeset/memo-error-resume.md` (patch).

## Deviations

- Edited `packages/brumate/test/scope-ids.test.ts` (not in the brief): `MemoError` is a class of shared.ts, so the test wants it listed. It holds an error, which has no scope IDs.
- `client/updates.ts` only lost the class and imports it.
- No split of client code by page: the codegen cannot tell that a memo fails on the server, since that depends on data at run time. The client cost is the class move and the `x` entry.

## Stubs left

- None.

## Gotchas

- The page state check for classes uses a symbol mark, `Symbol.for('brumate.held')`, not `instanceof`, because the compiled page and the serial plugin can load different copies of the runtime (tests do after `vi.resetModules()`).
- Code that reads the memo in the script body of the server (outside markup) still throws on the server. Only the page state changed.
- A failed memo is logged once per render in production, even when nothing reads it.

## Proposed learnings

- A value in the page state that a plugin must recognise is marked with `Symbol.for`, not tested with `instanceof` | copies of the runtime differ across module graphs | packages/brumate/src/runtime | yes (the resume test)
- An error that goes to the browser follows `errorAnswer`: a `ServerError` message or a generic one, never a stack | server details stay on the server | packages/brumate/src/runtime | yes (the resume tests)

## Verification

- The new test failed on main (the handler read the pending promise, not the error); now `npx vitest run test/resume.test.ts -t "holds the server error after resume"`: 3 passed.
- `npx vitest run` in packages/brumate: 1085 tests, all pass after the scope-ids fix.
- `npx vitest run --maxWorkers=2` in packages/ui: 1 failure, `generics-markup.test.ts`, which fails the same way on main (base worktree).
- `npx oxlint` (warnings only), `npx tsc --noEmit` in packages/brumate (no errors outside `test/`, which need the brumate dist types in a worktree), `npx oxfmt --check` (only `docs/roadmaps/brumate/reviews/wave-8.md`, already unformatted on main).
- Not run: e2e.

## Size

- todos, gzip -9 of all JS of `benchmarks/brumate/dist`: 28883 B on main, 28919 B here, +36 B (limit 100 B). `pnpm bench` does not run in a worktree, and the browser metric needs a server build that the worktree does not have.
- Estimated M, actual M.
