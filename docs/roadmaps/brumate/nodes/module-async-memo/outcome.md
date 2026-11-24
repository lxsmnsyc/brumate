# Outcome: module-async-memo

## Built

- `packages/brumate/src/runtime/store.ts`: `memoStore(sources, fn, options?)`, the store that `$memo`, `$gate` (`{ g: guard }`), `$debounced` (`{ m: ms }`) and `$throttled` (`{ m: ms, t: true }`) compile to at the top level of a module. It replaces `heldDerived`, `gated` and `timed` (removed, with the `hold` path of `build`, which only they used; `derived` is as before #530 apart from the pending flag). It holds an error, computes when read and again when a source changes, also one that changed while nothing followed it, and loads a promise or an async iterable: the last value stays while a load is out, only the latest run is written, and a stream is read once for all readers (the server keeps its first value and stops it). A store that reads a memo with no value yet waits for it (`Waiting`, with the browser's message `This value is still loading…`), so a gate or a timed value over a memo that loads waits too. `i` is what an importer reads with `$store`: on the server the value, or for a value that loaded a promise in the wrapper of a promise prop; in the browser it takes that value on resume (`s`) and sends on each change. `p()` gives the value or a promise of it. A failed load is shared by the renders that read its run (`brumate.render`, the call results of the render, from `request.ts`), and a later render loads again. `build` and `memoStore` share `enqueue` (moved out of `build`, same code).
- `packages/brumate/src/runtime/client/context.ts`: `subscribeSlot` gives a module memo the value that the server sent (`s`), behind the new feature `moduleMemos` (`features.ts`, `runtime/features.ts`), as a bridged store takes its data. A memo whose value computed at once computes again there, and a value of other sources repairs the page.
- `packages/brumate/src/module-signals.ts`: `$memo(await …)` compiles to `memoStore([sources], async ([sources]) => (…))`. An importer declares an imported memo, gate or timed value as `const $$ms_in_name = $store(store.i); const name = $memo(store.p($$ms_in_name))`, with `await` when the module memo awaits; one of the file's `<script module>` the same way. A signal and an optimistic value read the store with `$store`.
- `packages/brumate/src/analyze.ts`: a write to an imported memo keeps the message `Cannot assign to module memo "name". A memo is read-only` (BRM117).
- BRM211: the catalog description no longer names a memo that awaits; the pinned message in `test/error-codes.json` is unchanged. Generated `website/docs/errors.md` and the skill's `references/errors.md` regenerated.
- Tests: 15 new in `test/module-signals.test.ts` (51 in all). Fixtures `user.brm.ts`, `AsyncPage.brm`, `AsyncReader.brm`, `AsyncWriter.brm`, `AsyncForms.brm`, `AsyncFormsPage.brm`, `parity.brm.ts`, `ParityPage.brm`, `ParityView.brm`, `box.brm.ts`, `BoxView.brm`, `RowsView.brm`, `config.brm.ts`, `ConfigPage.brm`, `ConfigView.brm`. The unit tests of `heldDerived`, `gated` and `timed` run on `memoStore`. `resume()` of the test appends the streamed `#loading` bodies, as a browser does.
- Docs: "A memo that loads" in `website/docs/reactive-modules.md` and its lines on the forms; one line in `website/docs/async-data.md`; the module notes of `$memo`, `$gate`, `$debounced` and `$isPending` in `website/docs/reference-signals.md`; the skill's `references/syntax.md`; the module-signals entry of `docs/decisions.md`; `.changeset/module-signals.md`.

## Proof

Not a fix node.

## Result

Not an experiment node.

## Deviations

- Shared-load rule (server): one load for the latest source values, shared by every request of the process while it loads and after it settles. A source write on the server starts one new load at the next read. A failed load goes to the renders that read its run (two readers of one render start one load), and the next render loads again (the coordinator's decision in review of #531). Tests: "shares one load between server requests, until a source changes" and "goes to the requests that read it, and a later request loads again".
- Page state: the `$store` slot holds the value, as on main, and the importer's memo slot sends it again. An object goes once (a reference); a number or a string goes twice. `RowsView` (a count over 5000 rows) sends 191 bytes, `s:[5000,5000]`, where main sends the one slot. A value that loaded goes as a promise in the prop-promise wrapper.
- Every imported memo, gate and timed value is a memo of the importer, also one that never loads: the runtime cannot tell a promise from a value before it computes.
- Files outside the owned and shared lists: `src/runtime/client/context.ts` (the seed, behind the flag), `src/features.ts` and `src/runtime/features.ts` (the flag), `src/runtime/request.ts` (`brumate.render`), `website/docs/reference-signals.md`, `packages/brumate/skills/brumate/references/syntax.md`, and the generated `website/docs/errors.md` and skill `references/errors.md`.
- `brumate.render` is set with `??=`: the first copy of the runtime that loads keeps it, as a test that loads the server modules again renders with the first copy.

## Stubs left

None.

## Gotchas

- `memoStore` follows its sources without computing when the first subscriber is the importer's `i` (resume) and has not run; once it has run, a new first subscriber computes again if a source changed meanwhile. A store that reads a memo store follows it with `f`, which does not compute it.
- The server sends a value that loaded as a promise, so the browser takes it without computing; a memo, gate or timed value whose run, or whose memo sources, loaded counts as loaded (`a()`).
- The browser decides server or browser by whether the store has a subscriber (`i.get`), not by `onServer()`, which is false after an `await` of a render in the test environment.

## Proposed learnings

None.

## Verification

- `pnpm --filter brumate exec vitest run test/module-signals.test.ts`: pass (51).
- `pnpm exec oxlint`: 0 errors. Root `pnpm exec oxfmt --check`: pass. `pnpm typecheck`: pass.
- `pnpm build && pnpm test`: brumate 123 files, 3598 tests pass; every other package passes, but `packages/ui` `test/Button.test.ts` had two press tests time out at 2 s under load. Rerun alone, the file passes (26 tests).
- `node e2e/run.mjs`: pass (website 81, todos 10, tracker 18, nitro 2, kit 5, ui 61, browser-async 6, trace 6, scripts 7, transitions 7).
- `pnpm --filter website check:samples`: 72 samples, 0 problems.
- `pnpm bench --only brumate --scenario todos`: branch and base 542a0658 both give JS before `load` and total JS 35.3 kB / 14.6 kB, client JS emitted 88.0 kB / 31.1 kB.

## Size

- Estimated M, actual L after review: the forms moved onto `memoStore`, and the seed on resume needed a feature flag and a promise wrapper.
