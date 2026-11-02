# Log: wait-later-memo-update

## 2026-11-02

- Worktree at origin/feat/browser-async 2b1d12ca.
- Failing test first: new describe at the end of `test/resume.test.ts`, WaitDestr with the prop changed before the first load settles. On 2b1d12ca it fails with `TypeError: Cannot read properties of undefined (reading 'name')` from `u6` of `WaitDestr.brm.client.update.ts` (`$$b.text($$s, 1, $$b.get($$s, 5).name)`), through `later` in `queue`.
- Cause: during the first wait, `scope.s` holds only the slots of the code before the first `await` (the `slots` of `wait`, length 5). The write of `id` reruns `m4`, the memo of `user2` (slot 5). `asyncMemo` keeps the old value, which is a hole, and `startLoading` triggers the readers of slot 5, so `u6` reads `undefined.name`. `u5` reads slot 4, which holds the wait's promise, so it did not throw.
- The same class covers any update or block (`u`, `b`) that reads a slot past the wait, and a memo after the `await` that reads one.
- Options weighed: a scope field "waits" (new state outside the slots, P14); putting the load promise in the hole in `asyncMemo` (changes what handlers read for any hole, and does not cover memos after the await that read the waiting memo); passing later awaited promises in the wait's slots from codegen (setSlots marks them in `renderedLoads`, so the memo would not load again; also overlaps codegen).
- Chosen: `get` throws `NotReady` when update code (`exempt > 0`) reads a slot that is not in `scope.s`, and `later` skips a `NotReady`. The pending state is the hole in the slots. The rest of the render writes the page from the slots, so the skipped update is not needed.
- Checks: build, lint (0 errors), format:check, typecheck, brumate tests 2094 of 2095; "reads a memo created in the browser as pending until its first load lands" failed once under load, passed alone 3 of 3 (twice by name, once with the whole file).
- Bench todos: 32.3 kB raw, 13.5 kB gzip, click checks pass.
- Review round 1 (fresh reviewer, pr-review): no blocking. Should-fix: a test for a plain memo after the awaits that reads the later awaited memo, since its `NotReady` goes to `startLoading` and could leave it pending. Added WaitDerived fixtures and a second test (05ca4cfe); both tests fail on the base `updates.ts` and pass with the fix. Expanded the comment in `get`.
- Checks after round 1: build, lint, format:check, typecheck, brumate tests 67 files, 2098 pass.
- Review round 2: clean.
