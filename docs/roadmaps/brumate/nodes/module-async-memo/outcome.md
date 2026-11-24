# Outcome: module-async-memo

## Built

- `packages/brumate/src/runtime/store.ts`: `memoStore(sources, fn, options?)`, the store that `$memo`, `$gate` (`{ g: guard }`), `$debounced` (`{ m: ms }`) and `$throttled` (`{ m: ms, t: true }`) compile to at the top level of a module. It replaces `heldDerived`, `gated` and `timed` (removed, with the `hold` path of `build`, which only they used; `derived` is as before #530 apart from the pending flag). It holds an error, computes when read and again when a source changes, also one that changed while nothing followed it, and loads a promise or an async iterable: the last value stays while a load is out, only the latest run is written, and a stream is read once for all readers (the server keeps its first value and stops it). A store that reads a memo with no value yet waits for it (`Waiting`, with the browser's message `This value is still loading…`), so a gate or a timed value over a memo that loads waits too. `i` is what an importer reads with `$store`: on the server a marker (`0`) for a value that computed at once (or the value itself when it is an object, shared by reference with the importer's memo slot), and `[promise, sources]` for a value that loaded, with the source values by name (`n`, from the compiler); in the browser it takes that on resume (`s`): it recomputes a value that computed at once, takes a loaded value while its own sources are the same, and loads once with the old value kept when they differ. It sends on each change. `p()` gives the value or a promise of it. A failed load is shared by the renders that read its run and kept by each of them for the rest of the render (`brumate.render`, the call results of the render, which `withEvent` in `request.ts` writes on `globalThis`), and a later render loads again. `build` and `memoStore` share `enqueue` (moved out of `build`, same code).
- `packages/brumate/src/runtime/client/context.ts`: `subscribeSlot` gives a module memo the value that the server sent (`s`), behind the new feature `moduleMemos` (`features.ts`, `runtime/features.ts`), as a bridged store takes its data. A memo whose value computed at once computes again there, and a value of other sources repairs the page.
- `packages/brumate/src/module-signals.ts`: `$memo(await …)` compiles to `memoStore([sources], async ([sources]) => (…))`. An importer declares an imported memo, gate or timed value as `const $$ms_in_name = $store(store.i); const name = $memo(store.p($$ms_in_name))`, with `await` when the module memo awaits; one of the file's `<script module>` the same way. A signal and an optimistic value read the store with `$store`.
- `packages/brumate/src/analyze.ts`: a write to an imported memo keeps the message `Cannot assign to module memo "name". A memo is read-only` (BRM117).
- BRM211: the catalog description no longer names a memo that awaits; the pinned message in `test/error-codes.json` is unchanged. Generated `website/docs/errors.md` and the skill's `references/errors.md` regenerated.
- `packages/brumate/src/runtime/server.ts`: the error of a source of a loaded module memo that cannot be sent names the source and the memo.
- Tests: 19 new in `test/module-signals.test.ts` (55 in all). Fixtures `user.brm.ts`, `AsyncPage.brm`, `AsyncReader.brm`, `AsyncWriter.brm`, `AsyncForms.brm`, `AsyncFormsPage.brm`, `parity.brm.ts`, `ParityPage.brm`, `ParityView.brm`, `box.brm.ts`, `BoxView.brm`, `BoxLoadedView.brm`, `LongView.brm`, `RowsView.brm`, `config.brm.ts`, `ConfigPage.brm`, `ConfigView.brm`. The unit tests of `heldDerived`, `gated` and `timed` run on `memoStore`. `resume()` of the test appends the streamed `#loading` bodies, as a browser does.
- Docs: "A memo that loads" in `website/docs/reactive-modules.md` and its lines on the forms; one line in `website/docs/async-data.md`; the module notes of `$memo`, `$gate`, `$debounced` and `$isPending` in `website/docs/reference-signals.md`; the skill's `references/syntax.md`; the module-signals entry of `docs/decisions.md`; `.changeset/module-signals.md`.

## Proof

Not a fix node.

## Result

Not an experiment node.

## Deviations

- Shared-load rule (server): one load for the latest source values, shared by every request of the process while it loads and after it settles. A source write on the server starts one new load at the next read. A failed load goes to the renders that read its run (two readers of one render start one load), and the next render loads again (the coordinator's decision in review of #531). Tests: "shares one load between server requests, until a source changes" and "goes to the requests that read it, and a later request loads again".
- Page state: the importer's memo slot sends the value; the `$store` slot of `.i` sends `0` beside it (an object goes once, by reference), or `[promise, sources]` for a value that loaded. A long string goes once. The sources of a loaded memo must be data the page can send (the maintainer's decision); those of a sync memo are never sent.
- Every imported memo, gate and timed value is a memo of the importer, also one that never loads: the runtime cannot tell a promise from a value before it computes.
- The compiled call of each module form gains `n`, the names of its sources.
- Files outside the owned and shared lists: `src/runtime/client/context.ts` (the seed, behind the flag), `src/features.ts` and `src/runtime/features.ts` (the flag), `src/runtime/request.ts` (`brumate.render` in `withEvent`), `src/runtime/server.ts` (the named error), `website/docs/reference-signals.md`, `packages/brumate/skills/brumate/references/syntax.md`, and the generated `website/docs/errors.md` and skill `references/errors.md`.

## Stubs left

None.

## Gotchas

- `memoStore` follows its sources without computing when the first subscriber is the importer's `i` (resume) and has not run; once it has run, a new first subscriber computes again if a source changed meanwhile. A store that reads a memo store follows it with `f`, which does not compute it.
- The server sends a value that loaded as a promise in an array, since the browser puts the value of a top-level promise slot in its place; a memo, gate or timed value whose run, or whose memo sources, loaded counts as loaded (`a()`).
- The browser decides server or browser by whether the store has a subscriber (`i.get`), not by `onServer()`, which is false after an `await` of a render in the test environment.

## Proposed learnings

None.

## Verification

- `pnpm --filter brumate exec vitest run test/module-signals.test.ts`: pass (55).
- `pnpm exec oxlint`: 0 errors. Root `pnpm exec oxfmt --check`: pass. `pnpm typecheck`: pass.
- `pnpm build && pnpm test`: pass (brumate 3602 tests; ui 842 and 1 expected fail; every other package passes).
- `node e2e/run.mjs`: pass (website 81, todos 10, tracker 18, nitro 2, kit 5, ui 61, browser-async 6, trace 6, scripts 7, transitions 7).
- `pnpm --filter website check:samples`: 72 samples, 0 problems.
- `pnpm bench --only brumate --scenario todos`: branch and base 542a0658 both give JS before `load` and total JS 35.3 kB / 14.6 kB, client JS emitted 88.0 kB / 31.1 kB.

## Size

- Estimated M, actual L after two review rounds: the forms moved onto `memoStore`, and the seed on resume needed a feature flag, the sources of loaded values and a named error.
