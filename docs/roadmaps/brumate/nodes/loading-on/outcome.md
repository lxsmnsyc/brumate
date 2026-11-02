# Outcome: loading-on

## Built

- `#loading (m, …) { … } #else { … }`: once the body has shown, the block hides it with `hiding` (the `#offscreen` rules) and shows `#else` after it while a named memo, or a memo upstream of it, is pending, for any cause. When none is pending, the fallback goes and the same nodes show again.
- Analyzer (`packages/brumate/src/analyze.ts`): the header is a block site (`this.header`). `checkLoadingHeaders` runs after the resolver. Each name must be an identifier that resolves to a `memo` or `async-memo` that a non-handler site inside the body reads (`markupReads`), else BRM186. For each name it adds empty-range reads of `upstreamMemos(m)` to the header site, as `addPendingReads` does for `$isPending`, so the header updates when an upstream memo starts loading. A name that is or reads a `timing` memo (`$debounced`, `$throttled`) warns.
- Codegen:
  - `codegen/scopes.ts`: `isLoadingHeader(site)`. `blockingMemos` and `awaitedMemos` skip header reads, so the server does not wait for a named memo (a `$isPending(m)` in markup outside `#loading` does make it wait).
  - `plan.ts`: a live header block gets an anchor (from its live header site) and its body scope gets `needsId`.
  - `codegen/markup.ts`: `emitLoadingBody` puts `<!--b{scope}:{anchor}:1-->` and `<!--/b-->` around the body in the in-place render, the streamed (`$$ctx.defer`) render and the browser render (`bodyFunction` of `$$b.loading`). The fallback has no block markers. Blocks without a header have no anchor, so their output does not change.
  - `codegen/client.ts`: the update of the block is `$$b.held($$s, anchor, $$b.pending(…) || …, bodyKind, r<fallback>, kinds)`, with one `pending` check per named and upstream memo that has a slot. The fallback gets a render function (cloned, like `#if` and `#for` bodies). The body gets none.
- Runtime (`runtime/client/branches.ts`, exported from `brumate/client`): `held(scope, anchor, pending, kind, render, kinds, holderKind?, holderAnchor?)`. It finds the body by its marker. While the boundary's first fallback shows there is none, and it does nothing. The marker's third field holds the state (1 shown, 0 held). It hides the body scope with `hiding.hide` and inserts the fallback between two empty comments after the body's end marker. The release removes the fallback with `removeBlock` and calls `hiding.show`.
- BRM186 replaces BRM181 in `error-catalog.ts`, `test/error-codes.json`, `website/docs/errors.md` and the skill's `references/errors.md`.
- Tests in `test/resume.test.ts`, `describe('#loading (memo)')`:
  - A body that the server rendered in place hides and shows again, while a reader outside the body keeps the old value.
  - A body that the server streamed in hides and shows again with the same `<p>` and `<input>` and the typed value. This is the first test.
  - A memo that the header does not name keeps the content.
  - Effects and a `window` listener of the hidden body pause. A write still updates its text, and the effect runs again on release.
  - A chained memo: `#loading (label)` holds while `user` upstream loads.
  - A body that the browser rendered in an `#if`. Closed while held and opened again.
  - A server function's `refresh` of the named memo.
- Tests in `test/diagnostics.test.ts`, `describe('#loading header')`: the header compiles, BRM186 for an unread memo, a signal and a member expression, and the `$debounced` warning.
- Fixtures: `loadingOn.brm`, `loadingOnInPlace.brm`, `loadingOnChain.brm`, `loadingOnHost.brm`, `loadingRefresh.brm`.
- Docs: website/docs/async-data.md ("Show the fallback again", with the `#key (id)` idiom), docs/grammar.md (`Ident` list, BRM186), docs/decisions.md (the existing entry gets the build facts). Changeset `.changeset/loading-header-shows-fallback.md`, minor.

## Deviations

- The hold is `held` in branches.ts, next to `offscreen`, not in the `loading` closure of waits.ts. A body that the server rendered or streamed has no closure on the client. The update of the block's scope runs for both kinds of body. The `loading` closure and the client-pending-boundary contract do not change.
- No features.ts flag. Nothing in the core changes: `held` and the fallback render are exports that a page without a header block does not import, so the bundler leaves them out, and the todos size does not move. A flag would gate no code.
- The compile error and warning tests are in `test/diagnostics.test.ts`, next to the BRM181 tests they replace, not in resume.test.ts.

## Stubs left

- None.

## Gotchas

- Effects of a resumed body run first after a write, since the server ran them. A body hidden before any write has no cleanup to run, and its effects run when a write reaches them after the release.
- A branch that opens under the hidden body and loads with no `#loading` of its own shows as a second loading phase after the release (debate O9, accepted).
- A body that the browser renders shows with state 1 when its first fallback ends. If a named memo went pending again before that, the body shows the old value until the load settles, as without a header (review note, not reproduced).
- Not tested at run time: a header block in a `#for` row, a component in the `#else`, a header block inside `#offscreen` or another header block. The reviewer compiled each and checked the `held` calls.
- A memo of the header with no slot (one that never changes) adds no check. With no checks the block has no update and no markers.
- The bench's click checks FAIL on the base (01017a8e) as well, as topological-awaits-server recorded (missing `bundles` in the bench server, on next and feat/browser-async, not on main).

## Proposed learnings

- The header of `#loading (m)` reads whether memos are pending, not their values | a header read counted by `blockingMemos` makes the server wait for the memo and drops the fallback | packages/brumate/src/codegen/scopes.ts | yes

## Verification

- `pnpm install`, `pnpm build`, `pnpm lint` (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (67 files, 2050 tests): pass. Under a load average above 70 the beforeAll hooks of render/resume and some CLI tests timed out. Alone, and in a later full run at load 5, they pass.
- With `held` returning at once, the first test fails.
- Review round 1 (fresh reviewer, pr-review): no blocking or should-fix findings. Non-blocking: test coverage (the in-place body test added), the pending-before-first-show case (noted in Gotchas), the size above the estimate in a page with no other browser render, and the missing flag (Deviations).
- `pnpm --filter website check:samples`: 65 samples, 0 problems. The two new `brm` samples compile.

## Size

- Todos, `pnpm bench --only brumate --scenario todos`, JS before `load`: base (01017a8e sources) 33,036 B raw / 13,834 B gzip. This node: 33,037 / 13,831. No change beyond build noise. Click checks FAIL on both (see Gotchas).
- A page with one memo and a `#loading` block, vite production build, all chunks, gzip -9:
  - Nothing else that the browser renders: without the header 68,993 B raw / 24,089 B gzip, with it 75,875 / 26,451 (+2,362 B gzip). With an `#offscreen` block too: 73,363 / 25,678 and 77,234 / 26,961 (+1,283 B gzip). Most of it is the first browser render of the app: the clone of the fallback template and `insertHTML`.
  - With an `#if` that the browser renders too, a usual page: without the header 74,708 / 26,079, with it 77,610 / 27,066 (+987 B gzip, within the 1.3 kB estimate). With an `#offscreen` too: 77,913 / 27,174 and 78,621 / 27,419 (+245 B gzip, within the 0.3 kB estimate).
- Estimated M, actual M.
