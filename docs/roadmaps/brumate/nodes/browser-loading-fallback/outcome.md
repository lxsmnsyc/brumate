# Outcome: browser-loading-fallback

## Built

- `#loading` in markup that the browser renders (a branch of an `#if` that opens, a row that a `#for` adds, a component that a browser render renders) shows its `#else` while a memo that its body waits for loads, then the body, as a streamed block does. Updates after that keep the content.
- Compiler (`packages/brumate/src/codegen/markup.ts`): `emitClientLoading` compiles a client-mode `#loading` to `$$b.nodes($$b.loading(body, fallback))`, with a cloned function for each body (`bodyFunction`, which now gives HTML when there is no `hoist`). The body starts with `$$b.countLoads(scope, [memos])` for the memos it reads from outside (`awaitedMemos`, what the server's `emitLoading` awaits). `emitSlots` adds `$$b.countLoads(scope, [memos])` after `setSlots` for the memos of a scope that the server waits for where they are declared (`blockingMemos`). `mayLoad` picks memos that can hold a promise (every `async-memo`; a `memo` that is not a primitive, an array or a function). A client-mode `#reveal` whose children can render a `#loading` (`mayReveal`: a `#loading`, a component, a dynamic tag or an insert) compiles to `$$b.nodes($$b.reveal(order, collapsed, body))`.
- Runtime (`packages/brumate/src/runtime/client/waits.ts`), exported from `brumate/client`:
  - `loading(body, fallback?)`: joins the `#reveal` group of the render (`revealing`) and clears it for its own body and fallback, then renders the body with `bound`. With no wait (and no `#reveal` turn), it returns the body's nodes. Otherwise it returns two empty comments around the fallback; `done` destroys the fallback's scopes, clears the range, `give`s the body's work and inserts the body. `f` keeps the fallback and destroys the held scopes. A block that closed during the hold drops the body.
  - `countLoads(id, values)`: in a boundary, counts each thenable with `join`; `leave` on settle, `failOnce` (`fail` once per error and scope, then `fault`) on rejection. A no-op outside a boundary and when the `loading` feature is off.
  - `reveal(order, collapsed, body)`: renders the body with a group of the server's four orders and `collapsed` set as `revealing`, so the blocks of components inside it join; the group closes in a microtask. Its order code hangs on the group (`t`), so a page without `#reveal` drops it.
  - `failOnce`, shared with `fillSettled`.
- Feature flag `loading` (`packages/brumate/src/features.ts`, `packages/brumate/src/runtime/features.ts`, `__BRUMATE_HAS_LOADING__`): on when client code calls `$$b.loading(`.
- Tests: `packages/brumate/test/resume.test.ts`, `describe('#loading in markup that the browser renders')`, 13 tests: a child component's memo in an `#if` that opens; a block-script memo; a component that the browser renders with its own `#loading` over an instance memo; an awaited memo of a child (`wait`); `#for` rows added later, settled out of order; keep-content on an update; a block that closes during the wait and opens again; `#reveal ('sequential', collapsed)` order and the next fallback coming in; `#reveal` over two components with their own `#loading`; a server `#try` around a rejected load (the `#catch` once, no `brumate:error`, no unhandled rejection); a failed load without `#try` keeps the fallback and reports once; a page whose `#loading` only the server renders ships no `#else` in its client modules, and the flag. Fixtures in `packages/brumate/test/render/`: `LoadUser.brm`, `loadingHost.brm`, `loadingScript.brm`, `LoadingSelf.brm`, `loadingSelfHost.brm`, `loadingWaitHost.brm`, `loadingRows.brm`, `loadingReveal.brm`, `loadingRevealParts.brm`, `loadingTry.brm`.
- Snapshots in `packages/brumate/test/__snapshots__/render/` (doubler, loading, memos, search, todos) take the `countLoads` lines and the new client `#loading`.
- Docs: website/docs/async-data.md (the `#reveal` and "no fallback yet" lines), docs/decisions.md:27.
- Changeset `.changeset/loading-fallback-in-browser-renders.md`, minor.
- contracts/client-pending-boundary.change-request.md: `loading`, `countLoads`, `reveal` as exports of waits.ts.

## Deviations

- The brief's `$$b.loading(body, fallback)` needs `countLoads` and `reveal`: the memos that a body reads without `await` wait nowhere in the contract, so nothing would hold the boundary for them. Change request filed.
- Files outside the owned paths: `runtime/client/waits.ts`, `runtime/client.ts`, both `features.ts`, the fixtures, the snapshots, the docs, the changeset. The runtime half of the block has no other home.
- P14 (pending and fallback state in scope slots): the pending state is read from the values that the slots hold; the fallback state is in the `Boundary` and the closure of `loading`, not in a slot. No write is held back.
- `countLoads` follows the value, as `fillSettled` does, not the slot: a newer load that a prop starts during the hold does not hold the body; the body shows when the first value settles and the update fills the newer one.

## Stubs left

- None.

## Gotchas

- `#reveal` orders the `#loading` blocks rendered while its body renders. A block that a later update adds inside it (a new row, a branch that opens) is not ordered. A second rejection of a body that already failed is not reported, since its scopes are gone.
- A memo that recomputes and keeps its old value while it loads (`loadingSlots`) is not a thenable, so `countLoads` does not count it.
- loading-on (the header) can build on `loading`: the range comments, `showBody`, and the fallback render are in one closure; a header re-show adds `hiding` there and does not need the contract.
- `bound` callers set `done` right after it returns; `loading` also calls `done` at once for a body that only waits for its `#reveal` turn.
- A server `#try` is needed for a rejected load to reach a `#catch`; a browser-rendered `#try` has no `t` entry yet (browser-try).
- Bug on origin/main too (not fixed here): an async memo whose expression is a template literal, binary or other "primitive" node with `await` inside (`$memo(\`Hi ${(await load()).name}\`)`) is skipped by `settledMemos`(markup.ts,`isPrimitive`), so a browser render writes the promise as empty text and nothing fills it.

## Proposed learnings

- A browser `#loading` counts the memos that the server waits for: `blockingMemos` at their scope, `awaitedMemos` at the body | counting every pending slot holds the fallback for memos that only effects read | packages/brumate/src/codegen | yes
- An `async-memo` is a promise in the browser whatever its expression node | `isPrimitive` sees the template literal, not the async IIFE | packages/brumate/src/codegen | yes

## Verification

- `pnpm install`, `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (66 files, 1989 tests): pass.
- With `loading` returning the body at once, 10 of the 11 first tests fail.
- Review round 1: one should-fix (`#reveal` did not order the blocks of components inside it), fixed in d3ca3fb2 with a test; three non-blocking noted. Round 2: clean; two non-blocking taken (`mayReveal` counts inserts, a doc comment).

## Size

- Todos, `pnpm bench --only brumate --scenario todos`, JS before `load`: before 32,889 B raw / 13,859 B gzip (d6a415ee), after 32,890 / 13,853.
- A page with an `#if` whose branch reads a block-script memo, vite production build, all chunks: without `#loading` 73,751 B raw / 25,771 B gzip; with a browser `#loading` 75,611 / 26,501 (+730 B gzip, +667 in the core); with `#reveal ('sequential', collapsed)` and two blocks 76,251 / 26,751.
- Estimated M, actual M.
