# Outcome: drop-unread-memos

## Built

- `findUnread` in `packages/brumate/src/graph.ts`, exposed as `Graph.unread`: memos that no browser code reads, and memos that only such a memo reads. Their sites are not client roots and their nodes are not live, so no slot, update part or compute is written for them.
- `Emitter.emitStatements` (`packages/brumate/src/codegen/markup.ts`, client mode) leaves out the declaration of an unread memo, and keeps the other declarators of the same statement. The server output is unchanged.
- `unreadMemo` and `watchUnreadMemos` stay for one case: a memo that only an `await` reads (`await side;`). The server waits there and throws, and the browser compiles `await side` to a plain read, and `countLoads` does nothing outside a boundary. Everything else they covered is gone, since those memos do not run.
- Docs: `website/docs/reactive-graph.md`, `website/docs/what-runs-where.md`. Patch changeset `.changeset/drop-unread-memos.md`.
- Unread browser memos in packages/ui, website and examples: 0 of 351 (618 `.brm` files, counted with a script that runs `analyze` and `buildGraph`; 0 with no read, 0 read only by `await`). The change has no effect on todos.
- Differential divergences: 43 pages on 17 causes before; 38 pages on 17 causes now. 5 pages left `memo-reject` (AwaitFieldKid, AwaitMemoKid, AwaitSumKid, PrimitiveAwaitUnreadKid, UnreadMemoKid); memoErrorAwaitServer stays, with a reworded reason. Special causes to remove: still 11.

## Deviations

- No file outside the shared paths changed. New fixtures and data files are under `packages/brumate/test/`.
- `docs/decisions.md` is not edited (not a shared path). Line 26 already says the server computes a memo when first read; the browser now follows it. The orchestrator may add a line.
- A new fixture AwaitShownKid is an opt-out of the differential test (it throws on purpose).

## Stubs left

- A memo that only one branch reads still runs when the branch is closed (a later step in the brief).
- A read inside a function that nothing calls still counts as a read.

## Gotchas

- The `let` rewrite before an `await` of a split render slices the patched statement from its offset; the patch can rewrite `const`, so do not slice the code string by length.
- `test/render/unreadMemoData.ts` and `awaitReadData.ts` count runs in `globalThis.failRuns`.

## Proposed learnings

- None.

## Verification

- PR #447 (draft, against `next`), branch feat/drop-unread-memos.
- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm --workspace-concurrency=2 -r typecheck`: pass.
- `pnpm build`: pass. brumate tests: pass, with `uses-counter` snapshot updated. On the loaded machine (load average 25) `resume.test.ts` and the differential shards failed with timeouts and stale scopes when run in the full run; alone, `resume.test.ts` passes 604 of 604 and `test/differential` 531 of 531 (`--testTimeout` raised). Other packages' tests: pass.
- `node e2e/run.mjs --only ui`: 55 passed. `--only browser-async`: 6 passed.
- `pnpm bench --only brumate --scenario todos`: JS before `load` 13.6 kB gzip (same as the story's figure).

## Size

- Estimated M, actual S to M: the rule is one function in graph.ts and one skip in the emitter; most work was the tests.
