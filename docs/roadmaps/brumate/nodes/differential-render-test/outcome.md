# Outcome: differential-render-test

## Built

- A test that renders each page of `packages/brumate/test/render` two ways and compares them. The server path is `render` plus the loader resuming the page. The browser path is a generated wrapper page that holds the page in an `#if` that a click opens, so the browser renders it. The compare covers the markup, the head, the style sheets, the slots of the page scopes, and where errors go.
- Files, all in `packages/brumate/test/`: `differential/run.ts` (the harness), `differential/data.ts` (opt-outs, props, causes, divergences), `differential-1..4.test.ts` (four shards, about 131 pages each, so the pages render in parallel), `differential.test.ts` (checks the data: names exist, causes are used).
- 525 pages are rendered both ways: 482 match, 43 differ. 71 pages are opt-outs, each with a reason. A page in `DIVERGENCES` must still differ, so the test fails when someone fixes a case, and the entry is then removed. Runs in `pnpm --filter brumate test`; the four shards take about 30 s on four workers.
- Divergence count (the baseline for values-spike): **17 causes on 43 pages. 11 causes are special cases to remove (26 pages), 6 are accepted differences (17 pages).** Counting only the special cases to remove: 11.

### Divergences (`CAUSES` in `differential/data.ts`)

Special cases to remove:

1. ref-setter-relay (5 pages: setterRefPage, setterRefChangePage, setterRefRestPage, setterRefRelayPage, setterRefRelay3Page): a setter ref `$bind(signal, fn)` on a component; the resumed page calls `fn` with the element, the browser render does not.
2. ref-loop (refLoop): a ref in a list whose source reads the signal that the ref writes loops in the browser render ("did not settle"); the resumed page settles.
3. memo-throw (5 pages: memoErrorResume, memoErrorResumeShown, memoErrorServerOutside, memoErrorServerScript, memoErrorServerTwo): a `$memo` that throws in its first run. The server stores the error in the memo and a `#try` catches it; the browser render throws out of the component and renders nothing.
4. memo-reject (6 pages: AwaitFieldKid, AwaitMemoKid, AwaitSumKid, PrimitiveAwaitUnreadKid, UnreadMemoKid, memoErrorAwaitServer): a memo that nothing reads and whose promise rejects. The server render is silent; the browser render reports the error to onError.
5. pending-read (fnReadAsync, loadingChain, loadingOnChain): a memo or function prop that reads a property of a pending memo. The server holds the markup back; the first browser render reads undefined and throws.
6. template-import (tryTemplateChild): a bug. The render module of a page that uses a component only inside a `#template` in a `#try` lacks the import (`ReferenceError: TryKid is not defined`). The server module and the client part have it.
7. class-order (classes): class tokens in another order (`base off tail` and `base tail off`).
8. debounce-start (timing): `$isPending` of a `$debounced` value is false in the server render and true in the first browser render.
9. template-context (tplContextListPage): a `#template` that a child calls reads the context at its definition in the browser (default 0), and the child's value on the server (7).
10. try-rollback (tryRollback): a failed `#try` body keeps its `#portal` content, title and `#head` tags in the browser render; the server drops them.
11. function-prop-reads (fnReadUntrack): a function prop that a child reads runs one more time in the browser render (3 runs, 2 on the server).

Accepted differences:

12. lazy-ref (10 pages): a ref slot of a resumed page holds `{scope, anchor}` and the core reads the element when needed; the browser render holds the element.
13. await-in-script (PromiseLateChild, promiseLate): a component that awaits in its script or markup, in a child the browser renders, reports that only the server can render it (a designed limit).
14. defer-template (deferredLater): the server leaves a template element for `#defer`; the browser render has none.
15. awaited-slot (awaitedStream): the value of an `await $memo` is a slot in the browser render; the server sends none.
16. loading-scopes (RelayLoading, sourcedLoading): the browser render has scopes for a pending `#loading` body that the resumed page does not have yet.
17. error-stack (catchLeak): an error printed with its stack names different files.

Differences that the harness removes before comparing (accepted, not counted): comment markers and `b-` attributes; the order of attributes; generated IDs (`b0_0-0` and `b-2-0`; only which elements share an ID is compared); style sheets sit in the body on the server and in the head in the browser, so they are compared as a sorted list; the order in which scopes are made; scopes with no slots (the browser makes them, the server does not send them); scope numbers inside ref slots; the masking of error text in a `#catch` (the server render runs with `dev: true`).

### Opt-outs (71 pages, `OPT_OUTS`)

- 32 pages: the server render throws without the props of a parent (a function, a list or an object).
- 20 pages: the server render waits for a promise that only the test settles.
- 4 pages (preference, serialMoney, session, stream): use the request, the session or the serial entry.
- 4 pages: children that throw on purpose (AwaitReadKid, GapMarkupFailKid, PrimitiveAwaitFailKid, memoErrorAwaitOutside).
- 3 pages (deferred, deferredNested, deferredParent): read the request with `getEvent`.
- 5 pages (RevealPart, revealBackwards, revealOrder, revealTogether, streamedCatchTwo): need a prop with a record of promises.
- 2 pages (WinBody, windowedChildren): rows that need a table around them.
- 1 page (AsButton): renders only with the `as` and children of its parent.

## Deviations

- The commit subject is "differential-render-test: Compare server and browser renders", not the one the orchestrator gave (93 characters): the plain-writing hook refuses subjects over 72.
- The test is five files plus a folder (`differential-1..4.test.ts`, `differential.test.ts`, `differential/`) in `packages/brumate/test/`, not one file. One file took 130 s; four shards take 30 s. Everything stays under the shared path `packages/brumate/test/**`.
- No other file changed.

## Stubs left

- 71 opt-outs, listed above. Pages that need the props of a parent could be added with props in `PROPS` (a function prop needs a wrapper that defines it).
- Only the first render and what the page does by itself until it settles are compared. A page is not clicked, so updates after a click are not compared.

## Gotchas

- A fresh worktree needs `pnpm install` and `pnpm build` before `pnpm typecheck` passes.
- The page is settled when no module is in flight and the markup was unchanged for 30 ms (300 ms for pages with timers). A fixed sleep alone flipped about 20 pages under load.
- The test replaces the process listeners for unhandled rejections while it runs, to collect them as errors of the page, and restores them after.
- A wrapper page is compiled for each page, so `analyzeProject` sees the wrappers too; props reach the wrapper as literal attributes from `PROPS`.
- To work on one page, run a shard with `-t '<page>'`: `npx vitest run test/differential-1.test.ts -t refLoop` (the page is in the shard that its place in the sorted list picks, so try each).
- When values-spike changes a path, run the four shards: a page of `DIVERGENCES` that now matches fails with "no longer differs", which counts the divergences it removed.

## Proposed learnings

- Run a differential test of the two render paths for any change to `src/runtime/client/**` or the render module of the compiler | the paths share no code for the first render, and 43 pages show it | packages/brumate/test | yes

## Verification

- `pnpm lint` (warnings only, none in the new files), `pnpm format:check`, `pnpm typecheck` after `pnpm build`: pass.
- `pnpm --filter brumate exec vitest run test/differential`: 527 tests pass, 31 s; run twice at once, same result.
- `pnpm build && pnpm test`: pass. In one run on a loaded machine, `test/resume.test.ts` had 23 timing failures; alone it passes (597 of 597, 65 s).
- Not run: `node e2e/run.mjs` (nothing e2e touches changed), `pnpm bench` (test-only change).

## Size

- Estimated M, actual M. Triage of the 111 first differences took most of the work; the settle logic took two rounds.
