# Log: render-memos

2026-11-06, worktree .claude/worktrees/render-memos, branch fix/render-memos from origin/main e95c4ab2.

- Scratch edit first: deleted `refresh(live, true)` in insert.ts. Differential: timing and fnReadUntrack match. resume.test.ts: 4 failures (pending memo created in the browser, 3 awaits in block scripts). So the helper must start loads.
- Design 1: `renderMemo` returns a rejected promise on a throw. Rejected: reads in markup go through `failOnce`, which reports to onError even when a `#try` catches (cause memo-reject), and a render script that reads the memo does not throw. Design 2: return a `MemoError` and read memos through `readMemo` in the render module (as the server's `$$b.read`).
- `setSlots` started loads in `afterInsert`: the textarea test (code loads late) failed, because the boundary of `countLoads` leaves before the write of the settled value. Kept the early write.
- `setSlots` starting loads at once: a held `#loading` body that fails reported its error twice. Back to afterInsert, and wait() drops the callbacks of its first `setSlots`.
- promiseParent: a memo of a promise prop sits in the prop's slot, so `setSlots` must start it in the plain branch too. Aliased memos (`$optimistic(all)`) each load: counts in a WeakMap.
- The `give` refresh ran the memo of an awaited slot again (a prop changed during the hold). Fixed with a `memos` flag, not with `renderedLoads`.
- Vitest runs hung at about 1% CPU twice while the load average was 17; reruns with `--hookTimeout=120000` finish.
- Sizes: `scratchpad/size.sh` (brumate `pnpm build`, `rm -rf dist`, `npm run build`, sum of gzip -9). Main files swapped in from `git show origin/main:<path>` and copied back.

- Review fix: the test "lets a child that the browser renders await and chain a promise prop" that I called a flake was a regression. `setSlots` also wrote the settled value into a plain prop slot when a memo aliased the promise (PromisePlainChild), so `value.then` threw. The early write now skips plain slots: `isThenable(value) && !own.plain?.has(slot)`. Resume and render: 677 passed.
- memo-throw: `plain()` of the differential test counts a MemoError as no value. All 5 pages match, so the cause is removed.
