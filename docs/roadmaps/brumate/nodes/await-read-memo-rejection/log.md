# Log: await-read-memo-rejection

- 2026-11-02: Worktree from origin/main 1b6693eb. Kept only the await test of the proof patch, with renamed fixtures (AwaitReadKid.brm, awaitReadHost.brm, awaitReadData.ts).
- Compiled render of `const side = $memo(fail()); await side;` is `const side = (fail()); side;`. The `await` read is in `declaration.reads`, so `watchUnreadMemos` skipped it.
- `$memo(await side)` passes on main: the other memo holds the same promise and is watched. The failing form of the brief's second case is `$memo((await side).length)`, where the promise is dropped.
- Fix: in `watchUnreadMemos`, a memo counts as unread when every read is an `await` read, unless that `await` is the whole argument of a memo site. That exception keeps `$memo(await side)` from reporting the error twice.
- Tests: 3 fail on main (statement, field, `#catch`); the `$memo(await side)` test passes on main and guards against a second report.
- Draft PR #417. Review round 1: the exception compared only range starts, so `$memo(await side + 1)` watched neither memo. Fixed in b0b49696 (compare ends too), test added. Round 2: clean.
- `pnpm bench`: todos JS before `load` 14.8 kB gzip, same as main. The runtime is unchanged.
- One run of the full suite while the bench ran failed "refs forwarded through components" by timing; it passed 3 of 3 alone and in the full rerun (1316 passed).
