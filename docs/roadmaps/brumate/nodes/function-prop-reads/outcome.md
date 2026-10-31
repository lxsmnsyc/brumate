# Outcome: function-prop-reads

## Built

- Reproduced on main: a child memo (`title`) and a child markup call (`{label()}`) that use a function prop stay at the first value when the state the function reads changes. Three cases fail: a signal read by a function in a resumed page, the same in a child that the browser renders (`fnReadLater`), and a memo of the parent read by the function (`fnReadAsync`, the memo reloads with a new id). The markup call fails too, not only the memo.
- Cause: `graph.ts` skipped every function-valued prop site, so the prop never depended on the state the function reads.
- Fix in `graph.ts`, `analyze.ts` and `model.ts`: rule C2 of [the debate](../../../../debates/function-prop-derivations/debate.md). A function prop of a component is live when its function reads state, through the functions it calls (reads inside `$untrack` do not count). It stays fixed when the function or a callee writes state outside `$untrack`, when it calls through a context value or a prop outside `$untrack` (the Resolver sets `Site.opaqueCalls`), or when the attribute is an event. Writes follow `trackedCalls` only.
- Fix in `packages/brumate/src/codegen/client.ts`: the live function-prop sites are part of the update code, so the function they call is placed in the shared part.
- Tests in `packages/brumate/test/resume.test.ts` (describe "memos that read state through a function prop") with the pages `fnReadSync`, `fnReadArrow`, `fnReadLater`, `fnReadAsync` and the child `FnReadChild` in `test/render`.
- A child `$effect` that reads the prop runs again too, since the prop becomes a new function.
- Docs: one sentence in `website/docs/components.md`, one entry in `docs/decisions.md`, and a patch changeset for brumate.

## Deviations

- `packages/brumate/src/codegen/client.ts` and `model.ts` are not in the brief's shared list. The update code and the site flag needed them.
- The first version used the prop name and any write. The maintainer settled C2 in the debate and I reworked the node on the same branch. The decision entry in `docs/decisions.md` is final.
- Tests: `fnReadUntrack` (a write inside `$untrack` stays live), `fnReadCallback` (a callback that writes, called from a child effect, runs once per click) and `fnReadContext` (a write through a context function does not loop). Their fixtures come from the debate's evidence, renamed.

## Notes

- Limits: a callback that writes through code the compiler cannot see, and that is not a context or prop call, such as an imported store, still counts as a derivation. Function members of object props stay fixed. The client has no update-depth guard.
- Size: the sum of the gzip -9 size of the 7 client JS files of benchmarks/brumate (todos, built with vite, not the full `pnpm bench`) is 29,797 B on main and 29,803 B on the branch.
- Checks: see the pull request for the last run of lint, format, typecheck, and the brumate and ui tests.
