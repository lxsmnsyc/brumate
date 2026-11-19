# Log: async-effects

- 2026-11-19: no earlier work on the branch (BRM096 still reported, no `asyncEffect`).
- Probe: a read in an async callback after an `await` is taken as a dependency by the analyzer already (it reads the callback by name), so only the `declareEffect` check and the emit needed changing.
- `NotReady` only reaches a callback before its first `await`: `runningEffects` counts the synchronous part only, so a later read throws the handler message and goes to `fail`. No extra code for "after an await".
- Run state is a `Run` record per scope and name in a `WeakMap<Scope, Map<string, Run>>`: `busy`, `again`, a per-run `gone` token and the cleanup of the last settled run.
- Changes that come while the cleanup of the run before runs are the same run, so `again` is cleared after that cleanup (the callback reads live values after it).
- `reportCleanup` and `skipEffect` moved out of `effect` so both paths share them. `toCleanup` is in `updates.ts` and used by both.
- Tests reach `fail` through `onError`; a full `#try` render is covered by the existing `fail` tests.
