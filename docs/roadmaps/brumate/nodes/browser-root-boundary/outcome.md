# Outcome: browser-root-boundary

## Built

- The root boundary. Outside every `#loading`, a block that the browser renders keeps what it shows until the waits of its new body settle, as the server holds the page. A new `#for` row shows nothing until it settles.
- Runtime (`packages/brumate/src/runtime/client/waits.ts`), internal to the client runtime, on `bound` and `give`:
  - `hold(at, key, render, show)`. It renders the body in a boundary. With no wait, `show` runs at once. Otherwise the block keeps one held body per start comment (`holds`, a WeakMap), and `show` runs when the waits end. The same key again keeps waiting. Another key drops the held body and destroys its scopes.
  - `release(at)`. The block went back to what it shows. The held body goes when it settles, unless the block asks for the same key before then, which takes it back without a second render or load (B, A, B loads once).
  - `swap(scope, kinds, start, key, render, mark?)` for `#if`, `#switch` and `#key`. It records the scopes that the new body adds and destroys every other scope of the block's kinds when it shows, including scopes that the live old body made during the hold.
  - `holdRow(list, render)`. A new row that waits leaves an empty `<!--i<row id>--><!--/i-->`, so the next update of the list finds it and does not render it again.
  - `take` holds the drop and give logic shared by `hold` and `holdRow`. A body whose block left the page, or whose scopes went, is dropped.
- Sites: `branch`, `rekey` (and `retag`, which calls it), `fill` (`#client`), the first show of `offscreen`, the fallback of `list`, and new rows of `list` (and `windowList`). Each takes the `HAS_ROOT_WAIT` path, and the old code stays as it was for builds without the flag.
- Feature flag `rootWait` / `__BRUMATE_HAS_ROOT_WAIT__` (`src/features.ts`, `src/runtime/features.ts`). It is on when the client code of any component of the build calls `$$b.wait(`. `vite.ts` needed no change: `buildFeatures` joins every flag.
- `countLoads` counts when `HAS_LOADING || HAS_ROOT_WAIT`, so the root boundary also waits for the memos that the server waits for.
- `reportOnce` (`errors.ts`): one report per error and scope, shared by `unreadMemo` and the waits (`failOnce`). Once a boundary counted `await side;` of a rejecting memo, `unreadMemo` and `countLoads` both reported it.
- Tests: `packages/brumate/test/resume.test.ts`, `describe('a block outside every #loading that the browser renders')`, 10 tests:
  - an `#if` keeps its old branch and shows the sibling with the user;
  - B, A, B takes the held body back without a second load, and a switch back for good drops it;
  - a prop that the parent writes during the hold;
  - new `#for` rows that settle out of order;
  - the rows of a `#for` stay until its fallback settles, and rows that come back drop the held fallback;
  - a `#key` keeps its old body, and going back to the key that shows drops the held body;
  - scopes that the old body makes during the hold go when the new body shows;
  - the order of a swap with nothing to wait for: `script b`, `cleanup a`, `client b`;
  - the flag in `getFeatures`.
  - Fixtures: `HoldPart.brm`, `holdOrderHost.brm`, `holdKeyHost.brm`, `holdEmptyHost.brm`, `holdNestedHost.brm`.
- Existing tests changed from fill in place to the hold, since the browser now follows the server:
  - streamed-memo-reads: a promise prop memo in a browser-rendered child, with an attribute and with a textarea;
  - browser-await: "waits for the memo…", the constant awaited memo, and "opens, closes and opens again", which now loads once;
  - #419 and #421: "holds the block while another memo of the scope still loads" and "holds a component whose function prop reads the memo". Both use a memo that never settles, so nothing shows, as the server never sends it.
- Docs: website/docs/async-data.md (the `await $memo` item and the "outside every `#loading`" sentence), docs/decisions.md (the browser half of the `await` decision).
- Changeset `.changeset/blocks-hold-new-bodies.md`, minor.

## Deviations

- Cleanup order: with the flag on, a new body renders before the old one goes, also when nothing waits, so its script runs before the old cleanups. Its effects and `$client` callbacks still start after them, since they run after the insert. This is documented and tested. Keeping the old order would need to know before the render whether the body waits.
- Sites that still fill in place: `reset` of `#try`, `catchInto` (the `#catch` body), late `children`, `content`, the portal insert, and the fallback insert of `held` (loading-on). `catchInto` would make an import cycle (errors.ts to waits.ts) that oxlint rejects.
- Files outside the owned paths: `src/features.ts` (the flag has no other home), `errors.ts`/`updates.ts` are in `client/**`, the fixtures, the docs and the changeset.
- P14: no new hold of writes. A held body is a `Boundary` from `bound`, and the per-block record is the key and that boundary.

## Stubs left

- None.

## Gotchas

- The flag is per build. In a build where no browser render awaits, a memo that loads outside every `#loading` still fills in place. In a build where one does, every block outside `#loading` holds for such memos (`countLoads`, `fillSettled`).
- The old body stays live during the hold. It takes updates, so the old body of a `#key` that reads the key loads for the new key too (`[1, 2, 2]` with `WaitUser id=(k)`).
- `hold` also runs for blocks inside a `#loading` body that already showed, since update code runs outside any boundary. They keep their content too, which matches "later updates keep the content", but only the root case is tested.
- A held body whose memo never settles keeps its scopes in `scope.children` until the block closes or switches to another key. A released body does the same until it settles.
- `swap` counts as new only the scopes that the synchronous render adds to `scope.children`. A wait whose rest added scopes directly under the block's own scope would be destroyed when the body shows. No such path exists today, since a component's rest renders under the component's scope.
- The test for scopes that the old body makes during the hold passes on the first version too, because `destroyRange` finds the nested scope by its markers. It guards the case and does not reproduce a failure.
- `$effect` never runs on mount, so order tests need `$client(..., 'load')`.
- Bug on feat/browser-async, not on main (main has no `countLoads`): inside a browser `#loading`, a rejected unread memo read with `await side;` was reported twice. It is fixed here by `reportOnce`.

## Proposed learnings

- A block that holds a new body must tell its scopes from the old body's by the children that the render added | the scopes of a nested `#loading` body leave `rendered`, so `rendered` misses them | packages/brumate/src/runtime/client | yes

## Verification

- Review round 1 (fresh reviewer, pr-review): no blocking. Should-fix: scopes that the old body made during the hold could survive the swap; `rekey` with no start comment skipped its key. Both fixed in 386c522b. Round 2: clean, with the non-blocking notes above.

- Probe on 01017a8e: the 7 first tests fail as expected (see log.md).
- `pnpm install`, `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test`: 67 files, 2066 tests pass. `vite.test.ts` "runs a form posted twice once" failed once under load and passed 3 of 3 alone.

## Size

- Todos, `pnpm bench --only brumate --scenario todos`, JS before `load`:
  - before (01017a8e source): 33,036 B raw, 13,830 B gzip;
  - after, flag off: 33,038 B raw, 13,828 B gzip, which is the noise of the build ID and hash names;
  - flag forced on: 34,234 B raw, 14,286 B gzip, so +1,196 B raw and +458 B gzip. Every page of an app that uses `await $memo` in a browser render pays this. The spike estimated +455 to +505 B with `wait`, which todos does not include, so the real cost is about 150 B gzip higher.
- The bench click checks fail on this branch before and after (known until next is synced in).
- Estimated M, actual M.
