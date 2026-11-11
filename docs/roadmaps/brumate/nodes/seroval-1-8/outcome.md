# Outcome: seroval-1-8

## Built

- brumate depends on `seroval` 1.8.0, `seroval-plugins` 1.8.0 and `@seroval/transport` 0.1.0 (`packages/brumate/package.json`, `pnpm-lock.yaml`).
- No source module imports the root `seroval`. Each uses `seroval/read`, `seroval/write` or `seroval/shared` (`serial.ts`, `stream.ts`, `rpc.ts`, `request.ts`, `idempotent.ts`, `cache.ts`, `server.ts`, `devtools-calls.ts`).
- Plugins in `serial.ts` carry `validate` fields (`seroval/validator`). Every decode through `fromJSON` uses them: server function arguments, idempotent outcomes and the cache.
- `readArgs` in `server.ts` answers a payload that fails validation with 400 and `The arguments of the call are malformed: Plugin "brumate/element" received a value for "b" that failed its validator.`
- `stream.ts` (`toChunkStream`) writes with `createJSONWriter` and `toWebStream`. New `stream-read.ts` (`fromChunkStream`) reads with `createJSONReader` and `fromWebStream`. The own framing code is gone.
- Tests: `test/seroval-validate.test.ts` (new), a malformed-arguments test in `test/request.test.ts`.
- Changeset `.changeset/seroval-1-8.md`, minor.

## Proof

Not a fix node. Size of the first server function call, measured with the rpc chunk of the built package bundled with esbuild (minified, browser, one file, gzip -9), base 4829af28 built in a scratch worktree against this branch:

- base: `rpc` chunk 123.3 kB raw / 42.2 kB gzip.
- branch: 130.1 kB raw / 44.7 kB gzip, so +2.4 kB gzip on the first call. The todos page load (13.8 kB) does not change.
- Where the +6.8 kB raw comes from (bytes in the bundle, base to branch):
  - seroval: one `index` of 25.4 kB became `write` 10.5 + `read` 7.1 + `shared` 7.0 + `typed-array` 1.5 + `validator` 0.6 = 26.7 kB (+1.3). Needed: `toJSONAsync` is the write side and the answer is read with the read side.
  - seroval-plugins/web: 9.8 kB to 11.8 kB (+2.0). The 1.8 plugins carry `validate` fields. Not ours to cut.
  - @seroval/transport reader: `read` 2.5 + `frame` 1.2 + `read-frames` 0.6 + `message` 0.3 = 4.6 kB, against 1.7 kB of the old `stream` chunk (+2.9).
  - brumate `serial`: +0.15 kB for the validators.
- Tried to trim: nothing was left to cut that the brief allows. The write side is needed for the arguments, the plugins and the transport are libraries, and the transport reader is required by the brief. A smaller reader of our own would bring the old framing back.

## Deviations

- New file `packages/brumate/src/runtime/stream-read.ts`, not in the owned list. It keeps the transport writer out of the browser code that reads answers.
- "No client module pulls in the write side" holds for the transport and the page load, but not entirely. `rpc.ts` (loaded at the first server function call) imports `toJSONAsync` from `seroval/write`, because the browser must serialize the arguments. This is the seroval write side and cannot be dropped.
- "Page state goes through `seroval/validator`" is not done: the page state is code from the server, run by the browser, with no decode step. Validators run on what the server decodes from the network, and on the browser's decode of an answer, which uses the same plugins.
- `readArgs` in `server.ts` gained a try/catch (an error class mapping) beyond imports. The brief limits `server.ts` to shared use; this is the only logic change there.
- `toChunkStream` takes a third argument `onError`, which `answerCall` sends to the `onError` of the app.
- Docs: `website/docs/server-protocol.md` (chunk stream) and `website/docs/reference-security.md` changed.
- Tests that import `toJSON` from the root `seroval` were left, except `request.test.ts`.

## Stubs left

- None.

## Gotchas

- A validator failure is wrapped: the error thrown by `fromJSON` is a `SerovalDeserializationError` and the `SerovalPluginValidationError` is its `cause`.
- `validate` runs only for fields that `deserialize` reads with `ctx.deserialize`, so a plugin that reads a new field needs an entry.
- The wire format of an answer changed (transport frames). A page from before this version cannot read an answer from a server after it. The build skew check (409) covers deploys.

## Proposed learnings

- A plugin of brumate lists a validator for every field a client can send | the server decodes them from the network | packages/brumate/src/runtime/serial.ts | no

## Verification

- `pnpm build`: ok.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 5 files, 33.0 kB / 13.8 kB gzip. The base is 13.8 kB gzip, so no change (limit +0.3 kB). Client JS emitted in dist: 84.7 kB / 29.9 kB. The first-call chunk is not part of this number.
- `npx vitest run` in packages/brumate: 98 files, 3178 tests passed.
- Review fixes: `onError` of the writer, upload index as a non-negative safe integer, unknown plugin tag answers 400. New cases in `test/request.test.ts`. `pnpm --filter website check:samples`: 69 samples, 0 problems.
- `pnpm exec oxlint`: no errors (only existing warnings).
- `pnpm format:check`: ok. `pnpm typecheck`: ok.
- `node e2e/run.mjs`: website 74, todos 10, tracker 17, nitro 2, kit 5, ui 57, browser-async 6 passed, 0 failed.

## Size

- Estimated M, actual M.
