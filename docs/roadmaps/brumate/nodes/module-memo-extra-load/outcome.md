# Outcome: module-memo-extra-load

## Built

- A diagnosis, with the cause proven. Nothing outside this folder changed.
- `repro/cross-test-repro.patch`: makes the flake fail every time (5 of 5 runs red).
- `repro/regression-test.patch`: one test for the fix node. It fails on the base and passes with the fix.
- `repro/fix-probe.patch`: the fix that was tested.
- `repro/debug.patch`: the debug commits that ran on CI, kept for the record.

## Proof

- base: ec91f0da. With `repro/cross-test-repro.patch` applied, `RC_SLOW='resumes without a second load' npx vitest run test/module-signals.test.ts -t "an async memo of a module"` in `packages/brumate` failed 5 of 5 runs (`loop.py`: tight) with the CI symptom, `expected 3 to be 2` at the `browser.calls.user` line. `repro/regression-test.patch` alone fails with `expected 1 to be +0`.
- branch: not built (diagnose node). With `repro/fix-probe.patch` applied, the same loop passed 5 of 5 runs, the regression test passes, `module-signals.test.ts` passes (61 of 61), and the whole `packages/brumate` suite passes (3714 of 3714, one run).

## Diagnosis

- verdict: fix-small
- cause: `packages/brumate/src/runtime/client/context.ts:216-218`, since 394f0a88 (context-stores-spike); the check there became `scopes.get(scope.id) !== scope` in later commits. `stop()` of the loader calls `dispose()` of the core (`src/runtime/boot.ts:705`, `src/runtime/client/resume.ts:306-313`). `dispose()` does not end the store-read links of code loads still in flight. The `.then` of `resumeStoreReads` checks only that the scope is still registered, and `dispose()` removes no scope. So a component's code that finishes loading after `stop()` still subscribes its slots to the module's stores and seeds them with `i.s()`.
- reproduction: `nodes/module-memo-extra-load/repro/regression-test.patch`, which the fix node moves into `packages/brumate/test/module-signals.test.ts`.

### Symptom

`module-signals.test.ts` > "an async memo of a module" > "loads again when a source changes in another component, and writes only the latest run": `browser.calls.user` is 3, not 2. It fails only on a loaded machine. On CI it was seen once on Node 24, but nothing here depends on the Node version.

### Loop

1. CI run 45957311293 on branch `debug/module-memo-extra-load`: 20 jobs on Node 24, each running the file 30 times. With 3 `yes` CPU burners: 15 of 300 runs red, all with this symptom. With no burners: 0 of 300.
2. CI run 45958157156, with more logs: with burners, 3 of 300 runs red with this symptom, plus 1 run red in another test (see Gotchas). With no burners: 0 of 300.
3. Local loop with `repro/cross-test-repro.patch`: tight, 5 of 5 red. The patch holds the reader's code load of the test before ("renders on the server, ... resumes without a second load") until the next test's `beforeEach` has run.

### Evidence (CI logs, every red run)

1. The previous test ends after `sleep(40)`, but its loader is still loading `AsyncReader_mlmant`. `afterEach` stops the loader. `beforeEach` of the failing test calls `vi.resetModules()`.
2. The late import ends after the reset. It loads a new instance of `user.brm.ts` into the new module registry. The stale core's `resumeStoreReads` links the old page's scopes to that instance: `s n=["user"] ... value=loaded`, after which `count=1`.
3. The failing test's server render imports the same instance (the logs show one instance id). The memos already have readers, so `i.get` takes `count > 0` and returns `show()`, a plain value (`store.ts:1187-1188`). The server renders with no load: `rendered ... calls={"user":0,...}`.
4. The browser instance gets plain faces in the page state, such as `s n=["user"] value=plain:"USER 1"`. `i.s()` of `shout` takes the branch "it computed at once on the server" (`store.ts:1221`). `compute()` reads `marks()`, then `user.t()`, then `ensure()`. `user` has not been seeded yet, so it loads. That is `fetchUser n=1` with the stack `s` (1221), `compute`, `evaluate`, `marks`, `t`, `ensure`, `compute`. The clicks then load 2 and 3, which makes 3 calls in all.

### Hypotheses

1. Confirmed: code that loads after `stop()` links the stopped page's scopes to module stores. In these tests it links them to the next test's instance.
2. Ruled out: `follow()`'s `seen && changed(true)`, and `ensure()`'s `count === 0 && changed()`. The stack of the extra load goes through `i.s()` at line 1221.
3. Ruled out: a reader dropping to 0 subscriptions after a write. The extra load is `n=1`, before the first click's handler runs.
4. Ruled out: Node 24 timer order. Every CI job was Node 24, and the burners are what decides it (0 of 600 runs red without them). The local repro fails on Node 26.

### Fix options

1. Recommended. Links of loads in flight end when the loader stops. `resume.ts` `dispose()` bumps a counter. The `.then` at `context.ts:216` returns when the counter changed since the link started. `leaveRoutes()` (partial navigation) also calls `dispose()`, so the fix node splits it: only the loader's stop ends the links. Otherwise a kept layout whose code is still loading would lose its `$store` links during a navigation. Reach: one core function, one check, no public API, no stored data. Size: a few bytes in the client. Undo: reverts alone. `repro/fix-probe.patch` bumps the counter in `dispose()` itself. The full suite passed with it, but the fix node should keep navigation out of it as described. The fix node also checks the other continuations of `loadModule` for the same flaw after a stop: `branches.ts:163`, `errors.ts:39` and `insert.ts`.
2. Not recommended alone. Test only: `afterEach` of `module-signals.test.ts` (lines 43-48) waits for the loader's loads in flight before `stop()`, so a late link lands in the old registry. Verified green with the cross-test repro (5 of 5), with the file at 60 of 60. It fixes the flake, but a stopped loader would still link scopes, which breaks the promise in the comment at `boot.ts:202-204` ("Once stopped, the loader starts nothing"). It is a good addition to option 1, because it also isolates the other tests in the file.
3. Rejected: wait longer in the previous test (`sleep(40)` to more). That is a timing workaround, and it fails again on a slower machine.

Next step: a fix node (S, `fix`, target `release/0.10`) with a `hard` dependency on this node. Owns `src/runtime/client/resume.ts`, `src/runtime/client/context.ts` and `test/module-signals.test.ts`. It moves `repro/regression-test.patch` into the suite and needs a changeset (patch).

## Deviations

- The brief asked for a log of `fetchUser` calls. The second CI run also logged `i.get`, `i.s()`, the loader's `load` calls and the server instance. The first run's stacks showed the load came from `i.s()`, and these logs show why.
- Two CI triggers were used, of the 5 allowed.

## Stubs left

- None.

## Gotchas

- Many tests in `packages/brumate/test` start a loader with `start({ load })` and end it in `afterEach` without waiting for its loads: `resume.test.ts`, `client-order.test.ts`, `state-dedupe.test.ts` and others. Under load, any of them can leak a late link into the next test, which may explain the other flakes seen under load. One example: run 45958157156 had a red run in `module-signals.test.ts` > "the sources of a loaded module memo, as the page state sends them" > "a date that changed on the server loads once in the browser" (`expected '1 a 1 NaN' to be '0 a 1 NaN'`). Its log shows a late `loaded StampView_11w3hbw`. Not proven here.
- Other flakes from this session were not studied: "a failed load of a module memo on the server ...", the async memo tests under full-suite load, and `resume.test.ts` "an async memo whose input never changes, in a browser render > fills its text between other text" (5 s timeout on PR #539's CI run 45954152970). They fit the same class (a loaded machine, a loader that outlives its test) but are not proven. Rerun them after the fix.
- Vitest 5 prints no `console.log` output from passing tests here without `--silent=false`. Use `--silent=passed-only` to see logs of failed tests only.

## Proposed learnings

- A continuation of a code load in the client core checks that the loader still runs before it links or starts anything | a load can outlive `stop()`, and its links then reach a page that has ended | `packages/brumate/src/runtime/client` | yes (a load held until after `stop()`, as in `repro/regression-test.patch`)
- A test that starts a loader waits for the loader's loads in flight before the next test resets modules | a late import after `vi.resetModules()` loads into the next test's registry and shares its module instances | `packages/brumate/test` | yes (a shared `start` helper that tracks its loads)

## Verification

- `loop.py --runs 5 --symptom 'expected 3 to be 2'` with the cross-test repro: tight on the base (5 of 5 red), green with fix option 1 (5 of 5) and with option 2 (5 of 5).
- `repro/regression-test.patch`: red on the base (`expected 1 to be +0`), green with `repro/fix-probe.patch`.
- `npx vitest run` in `packages/brumate` with `repro/fix-probe.patch`: 129 files, 3714 tests passed.
- CI: runs 45957311293 and 45958157156 on `debug/module-memo-extra-load`, 1200 file runs in all. That branch was then deleted from the remote and locally. No `[RC-mmx]` or `[RC-fix]` marker is left in tracked files.

## Size

- Estimated S, actual S.
- Risk estimated low, measured low.
