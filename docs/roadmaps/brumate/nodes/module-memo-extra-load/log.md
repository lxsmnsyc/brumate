# Log: module-memo-extra-load

## 2026-11-27

- Worktree on `diagnose/module-memo-extra-load` from ec91f0da. `pnpm install`, `pnpm build` ok.
- The original failing job (run 45720810883, attempt 1, job 139578366268) no longer serves its first-attempt log through `gh`; the symptom is the one in the brief.
- Local Node is 26.12.1 (no Node 24 installed). The file passes alone in 10 s.
- Read the code paths. In the browser, `user` can load from: `i.s()` when the server's sources differ from the browser's (`store.ts` near line 1226), `ensure()` (`!has && !held && !wait`, or `count === 0 && changed()`), `follow()` (`seen && changed(true)`), and `state.run` after a source write. Reads of `.p()` by the reader's memo slots (`m1`..`m7` of `AsyncReader.brm.client.update.ts`) go through `ensure(true)`.
- Debug commit 94a193d8 on `debug/module-memo-extra-load` (patch in `repro/debug.patch`): logs each `fetchUser` call with a module instance id, a time and a 60-frame stack, logs the two clicks, and names the browser instance in the assertion message. Workflow `debug-mmx.yml`: 20 jobs on Node 24 (10 shards x burn 0 or 3 `yes` burners), each runs the file 30 times, 600 file runs per trigger.
- CI run 45957311293: burn 3 15/300 red, burn 0 0/300. Every red run: the extra call is `fetchUser n=1` from `i.s()` (`store.ts:1221`, the plain-value branch) of `shout`, through `marks()` and `user.t()` to `ensure()`. The server instance logged no `fetchUser`.
- Debug commit 08b8f3ed (second round) logged `i.get`, `i.s()`, the loader's loads and the server instance. CI run 45958157156: burn 3 3/300 red with the symptom plus 1 red in "a date that changed on the server loads once in the browser", burn 0 0/300. Logs: the previous test's `AsyncReader` load ends after `vi.resetModules()` and links its scopes to the new `user.brm.ts` instance (count 1). The server render then reads plain values with no load, and the browser's `i.s()` computes.
- A local repro holds the previous test's reader load until the next `beforeEach`: tight, 5 of 5. Fix probes: (1) `afterEach` drains the loads: green. (2) `dispose()` ends the links in flight (`context.ts:216`): green, and the full package suite passes (3714). Regression test (stop, then the late load, then a write): red on the base, green with (2).
- Deleted `debug/module-memo-extra-load` from the remote and locally. Patches are in `repro/`.
