# Outcome: module-async-memo

## Built

- `packages/brumate/src/runtime/store.ts`: `memoStore(sources, fn)`, the store that `$memo` compiles to at the top level of a module, in place of `heldDerived` (removed). It holds an error as `heldDerived` did, computes when read and again when a source changes, and loads a promise or an async iterable: the last value stays while a load is out, only the latest run is written, and a stream is read once for all readers (the server keeps its first value and stops it). Without a subscriber it computes again only when a source changed, so the server shares one load. A memo store that reads one with no value yet waits for it (`Waiting`, which carries the load and has the browser's message `This value is still loading…`). It has `i`, a store of the values of its sources (a memo source gives its own sources), and `p()`, the value or a promise of it. `build` and `memoStore` share `enqueue`, the queue of a derived store that a source told of a change (moved out of `build`, same code).
- `packages/brumate/src/module-signals.ts`: `$memo(await …)` compiles to `memoStore([sources], async ([sources]) => (…))`, and `ModuleSignal` records `form` and `awaits`. The importer side declares an imported memo as `const $$ms_in_name = $store(store.i); const name = $memo(store.p($$ms_in_name))`, with `await` when the module memo awaits; a memo of the file's `<script module>` the same way. A signal and the other forms still read the store with `$store`.
- `packages/brumate/src/analyze.ts`: a write to an imported memo, now a memo of the importer, keeps the message `Cannot assign to module memo "name". A memo is read-only` (BRM117).
- BRM211: the catalog description no longer names a memo that awaits; the pinned message in `test/error-codes.json` is unchanged, so the file is unchanged. Generated `website/docs/errors.md` and the skill's `references/errors.md` regenerated.
- Tests: 7 new in `test/module-signals.test.ts` (43 in all), fixtures `user.brm.ts`, `AsyncPage.brm`, `AsyncReader.brm`, `AsyncWriter.brm`. The test of `heldDerived` runs on `memoStore`; the `$memo(await …)` case left the BRM211 list. `resume()` of the test appends the streamed `#loading` bodies, as a browser does.
- Docs: "A memo that loads" in `website/docs/reactive-modules.md` and the lines that said a memo is a `derived` store or that `$memo(await …)` is BRM211; one line in `website/docs/async-data.md`; the module notes of `$memo` and `$isPending` in `website/docs/reference-signals.md`; the skill's `references/syntax.md`; the module-signals entry of `docs/decisions.md`; `.changeset/module-signals.md`.

## Proof

Not a fix node.

## Result

Not an experiment node.

## Deviations

- Shared-load rule (server): one load for each set of values of the memo's sources, shared by every request of the process while it loads and after it settles, as `export const user = store(fetchUser())` would be. A write of a source on the server starts one new load at the next read. A failed load is held until a source changes, on the server as in the browser. Test: "shares one load between server requests, until a source changes". Written in decisions.md and in the docs next to the line for signals.
- Every imported `$memo`, also one that never loads, is now a memo of the importer with a `$store` slot of its source values, not one `$store` slot of its value. The runtime cannot tell a promise from a value before it computes, and the browser must not compute on resume. The page state carries the source values of each imported memo, which must be data that the page can send (as a component's signal values). This changes the output of #530 for sync memos; its tests pass unchanged, except the BRM211 case that this node removes and the `heldDerived` unit test, moved to `memoStore`.
- Needs a decision: the browser's module store has no value after resume; the value is in the slots of the components that read it. Module code that reads the memo in the browser before a source changes, such as an exported function that a handler calls, loads it once there. Seeding the store from a component's slot needs a hook in `subscribeSlot` (shared runtime) or a forward read in the `$store` argument; not built. The docs say so.
- A gate, a debounced or a throttled value of a module that reads a module memo that loads computes the memo when a component subscribes to it, so the memo loads in the browser on resume, and until its first value the form holds `This value is still loading` as its error. Only a memo waits for a memo that loads. Not tested and not built; it needs `gated` and `timed` to wait as `memoStore` does.
- Files outside the owned and shared lists: `website/docs/reference-signals.md` and `packages/brumate/skills/brumate/references/syntax.md` (they said `$memo(await …)` is refused at the top level), and the generated `website/docs/errors.md` and `packages/brumate/skills/brumate/references/errors.md`.

## Stubs left

None.

## Gotchas

- `memoStore` follows its sources without computing when the first subscriber is the importer's `i` store (resume), and computes at once for a subscriber of its value (`subscribe`), as `derived` does. A memo store that reads another follows it with `f`, which does not compute it.
- The importer's `$$ms_in_name` slot is compared with `sameData` on resume, so a source that is a new array with the same items keeps the server value.
- On the server a stream's first value ends the load and the store stops reading it (`return()`), decided when the run starts (`onServer()`).

## Proposed learnings

None.

## Verification

- `pnpm --filter brumate exec vitest run test/module-signals.test.ts`: pass (43).
- `pnpm exec oxlint`: 0 errors (existing warnings only). Root `pnpm exec oxfmt --check`: pass. `pnpm typecheck`: pass.
- `pnpm build && pnpm test`: pass (brumate 123 files, 3590 tests; ui 842 and 1 expected fail; every other package passes). No timeouts.
- `node e2e/run.mjs`: pass (website 81, todos 10, tracker 18, nitro 2, kit 5, ui 61, browser-async 6, trace 6, scripts 7, transitions 7).
- `pnpm --filter website check:samples`: 72 samples, 0 problems.
- `pnpm bench --only brumate --scenario todos`: branch and base 542a0658 both give JS before `load` and total JS 35.3 kB / 14.6 kB, client JS emitted 88.0 kB / 31.1 kB. A page with no module signal ships the same client JS.

## Size

- Estimated M, actual M. The store was the work; the importer reuses the component memo with no compiler change beyond the expansion.
