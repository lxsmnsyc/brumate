# Log

- Existing test "keeps the prop live when the function writes inside $untrack" covers `$untrack` inside the function, not around the prop value. The verify command passed before the work, so the new test is the proof.
- Repro: `label=$untrack(nameOf)` made the server refuse to serialize the function prop, since `isFunctionValue` (graph.ts) did not see through `$untrack(...)`. The plan then had no handler part for `nameOf`.
- Decision: `$untrack(fn)` as a prop value means fixed prop, function still ships. No compile error.
- Fix: `isFunctionValue` unwraps an unbound `$untrack(x)` like the `brumate/events` wrappers. The rewrite already turns `$untrack(x)` into `(x)`.
- Test: fixture fnUntrackProp.brm with FnUntrackChild.brm. The child reads `label()` on click, so the test shows the function is shipped and the handler write reaches the state.
