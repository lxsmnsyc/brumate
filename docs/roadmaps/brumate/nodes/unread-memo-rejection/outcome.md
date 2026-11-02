# Outcome: unread-memo-rejection

## Built

- `unreadMemo(scope, value)` in packages/brumate/src/runtime/client/updates.ts, exported from `brumate/client`. For a thenable it sends a rejection to `fail` (the nearest `#try`, else `onError` and `brumate:error`).
- `Emitter.watchUnreadMemos` in packages/brumate/src/codegen/markup.ts. In client mode, after a declaration of a memo that has no slot and no reads, it emits `$$b.unreadMemo($$sN, name);`. Memos that `isPrimitive` accepts, such as `other * 2`, are left out.
- Tests in packages/brumate/test/resume.test.ts, describe "an unread async memo in a browser render": "reports its rejection to the page when no #try catches it, with no unhandled rejection" and "sends its rejection to the nearest #catch". Fixtures: test/render/UnreadMemoKid.brm, unreadMemoData.ts, unreadMemoHost.brm, unreadMemoTry.brm.
- Changeset .changeset/unread-memo-rejection.md (patch, brumate).

## Deviations

- The brief says a server render routes the rejection to `#catch`. It does not: the server memo is lazy, so a memo that nothing reads never computes and nothing fails. The browser render computes it in place, as it does for a memo that throws, so the fix sends the rejection where a throw goes.

## Stubs left

- None.

## Gotchas

- A `#try` whose body holds only a child component has no entry in its module's `t` table (`tryCatchesClient` in graph.ts looks only at its own component's sites), so no client error of the child reaches its `#catch`. The `#catch` fixture keeps a handler inside the `#try` for this reason.
- An async memo that only markup reads gets no slot either. In a browser render it shows empty and its value never lands, and its rejection is not handled. Separate bug, not fixed here.
- A memo whose only read is `await memo;` in the script, or `$memo(await a)`, still gives an unhandled rejection. The browser render turns `await a;` into `a;`, and the read keeps the memo from being watched. Found in review, not fixed here.
- Review round 1 (fresh agent, pr-review): no blocking findings. It reproduced both failures on main and checked block scopes, `$optimistic`, `$debounced` and double reporting.

## Proposed learnings

- A memo that the browser render computes but gives no slot must still have its promise handled | nothing else takes it | packages/brumate/src/codegen | yes

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "unread async memo"`: 2 passed; both fail with the codegen call removed.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm --filter brumate test` (1311 passed).
- `pnpm bench`: todos JS before `load` 14.8 kB gzip. Building the todos bench on the base code and on the fix gives +5 B gzip in total.

## Size

- Estimated S, actual S.
