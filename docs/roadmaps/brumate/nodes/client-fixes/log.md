# Log: client-fixes

2026-11-06, worktree .claude/worktrees/client-fixes, branch fix/client-fixes from origin/main 4d464e22.

- Sizes before: `pnpm build` in packages/brumate, `rm -rf dist && npm run build` in each example, sum of gzip -9 of dist/client/**/*.js. todos 39,366 B, ui 199,369 B.
- setter-after-render: `send` (updates.ts) now reads the reference of a handler that `handlerProp` made, and calls the export with `callNow`/`call`. `handlerReferences` moved from handlers.ts to references.ts so updates.ts can read it without a cycle.
- memo-reject: first tried `failOnce` alone. Not enough: the stack showed `settle` in `wait` (waits.ts) calling `fail` for the stored MemoError. `fail` got a third argument, `uncaught`: `onError` runs only when the search finds no `#try`. `reportOnce` (used by `failOnce` and `unreadMemo`) and the MemoError path in `wait` pass it. Handlers and effects keep reporting a caught error to `onError` (resume.test.ts "An error that a `#try` catches is reported too").
- class-order: `classTokens` returns undefined when a static class follows a condition, so that class attribute uses the generic path.
- Removed ref-setter-relay, memo-reject, class-order from `CAUSES` and `DIVERGENCES`. template-import untouched.
- Full packages/brumate run: 2 failures under load. refLoop timed out at 5 s (passes alone). "gives the element of a component in as" read '' once (fixed 100 ms sleep); it passed 5 more times alone, on main and with the change, and in a full resume.test.ts run (623 passed).
- With the old src files restored on top of the new data.ts, 7 differential pages fail (5 setter pages, memoErrorAwaitServer, classes).
