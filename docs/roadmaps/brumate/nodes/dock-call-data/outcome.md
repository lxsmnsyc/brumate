# Outcome: dock-call-data

## Built

The dev dock gets a record per server call. `CallTiming.record?: CallRecord` (types `CallRecord`, `ServerRecord`, `DevAnswer` in `packages/brumate/src/runtime/devtools.ts`; the contract `dock-call-record` has the final type).

Where it arrives in the browser:

- The fetch wrapper in `devtools.ts` clones the answer and calls `readCall` (`packages/brumate/src/runtime/devtools-calls.ts`, loaded with `import()` on the first call). It decodes the arguments from `init.body` and the result from the chunk stream, reads the `x-brumate-dev` header, and sets `call.record`, then `state.changed()`. The row exists first; the record fills in a moment after the answer. A call that failed at `fetch` has no record.
- Dev server: `handleDevRPC` in `vite.ts` runs the call inside `createRecorder`. It collects `console.log/info/warn/error/debug` output (by `AsyncLocalStorage`, so calls that run together stay apart), the server functions the function called, and the error with its real message and stack. They go back in the `x-brumate-dev` header (URL-encoded JSON, at most 6000 characters).
- Nested calls: `dedupe` in `request.ts` (it wraps every server function on the server) calls a hook, set only by the dev server, when no page render is running.

Fields: `args`, `result`, `error {message, stack}`, `timing {module, network, server, decode}`, `server {reads, calls, logs, truncated}`. See the contract for their meaning.

## Proof

Not a fix node.

## Deviations

- Touched `packages/brumate/src/runtime/request.ts` (a hook in `dedupe`, 6 lines), which is not in the owned or shared list. Nested calls cannot be seen without it.
- `server.reads` holds the IDs from `x-brumate-refresh` (functions whose memos reload), since a call on the server reads no memos otherwise. Label it "reloads" in the detail view.
- `timing.module` is the time from the owning interaction's `ready` to the request start, 0 outside a handler. The browser has no better mark.
- The base branch lacks the contract file and the node folder, so this commit adds the contract (copied from main, with the final type) and the log and outcome. `status` is still `draft`.
- Production size: no change to the client. The code is behind the dev-only devtools import and in `devtools-calls.ts`; a test checks the client build holds none of `x-brumate-dev`, `brumate.callHook` or `devtools-calls`. The hook adds one symbol lookup to the server `dedupe`. The todos bench was not run (the client does not include `request.ts`), so there is no gzip figure.

## Stubs left

- None. `dock-call-detail` can build against a fake `CallRecord`.

## Gotchas

- `server`, and the real `error` with its stack, are absent when the answer did not come from `handleDevRPC` (production, or a framework that runs the server code elsewhere, such as Nitro in a worker).
- The browser's own error for a failed call is the generic message; the record's `error.message` is the real one, so show the record's.
- `result` is absent for an error and for a redirect. Streamed parts of a result (promises, async iterables) are not awaited past the first value.
- Files in arguments appear as `[File name, size bytes, type]`.
- `calls` omits the browser's own call. Calls made while a page renders are not recorded here.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/devtools-calls.test.ts test/devtools.test.ts test/vite.test.ts test/server-on-error.test.ts`: 70 passed.
- `npx tsc -p . --noEmit` (after `npx tsdown`), `npx oxlint` (no new warnings in the touched files), `npx oxfmt --check`: pass.

## Size

- Estimated M, actual M.
