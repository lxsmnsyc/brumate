# Outcome: function-prop-reads

## Built

- Reproduced on main: a child memo (`title`) and a child markup call (`{label()}`) that use a function prop stay at the first value when the state the function reads changes. Three cases fail: a signal read by a function in a resumed page, the same in a child that the browser renders (`fnReadLater`), and a memo of the parent read by the function (`fnReadAsync`, the memo reloads with a new id). The markup call fails too, not only the memo.
- Cause: `graph.ts` skipped every function-valued prop site, so the prop never depended on the state the function reads.
- Fix in `packages/brumate/src/graph.ts`: a prop of a component whose value is a function (an identifier, an arrow or a wrapper of `brumate/events`) now depends on the values the function reads, through the functions it calls, when neither the function nor its callees write anything and the prop name is not `on` plus a capital. The graph then makes the prop live, so the child gets a slot for it and the parent writes the prop again, with a new bound function, when the state changes.
- Fix in `packages/brumate/src/codegen/client.ts`: the live function-prop sites are part of the update code, so the function they call is placed in the shared part.
- Tests in `packages/brumate/test/resume.test.ts` (describe "memos that read state through a function prop") with the pages `fnReadSync`, `fnReadArrow`, `fnReadLater`, `fnReadAsync` and the child `FnReadChild` in `test/render`.
- Docs: one sentence in `website/docs/components.md`, one entry in `docs/decisions.md`, and a patch changeset for brumate.

## Deviations

- The brief asks for the maintainer's decision. The docs already say the call is allowed, and a compile error would break working code, so I took "supported" for the 0.4.1 patch and recorded it in `docs/decisions.md` as pending the maintainer's confirmation. The compile-error option needs no work if the maintainer prefers it, but it is a breaking change.
- `packages/brumate/src/codegen/client.ts` is not in the brief's shared list. The update code needed the change.
- The rule uses the prop name (`onX` is a handler) because a handler that only calls a context function or a callback writes nothing the compiler can see. Without it, 5 tests of packages/ui failed (Radio `onChange=change`).
- Neither `analyze.ts` nor `error-catalog.ts` changed, since there is no new diagnostic.

## Notes

- Limits: a derivation that also writes a state is treated as a handler and does not update the child. A derivation named `onX` does not either. A function that reads a value through an imported helper that holds state is not tracked, as for any read.
- Size: the sum of the gzip -9 size of the 7 client JS files of benchmarks/brumate (todos, built with vite, not the full `pnpm bench`) is 29,805 B on main and 29,797 B on the branch.
- Checks: `pnpm lint` has no errors, `pnpm typecheck` passes, `pnpm format:check` fails only on `docs/roadmaps/brumate/archive.md`, which this node does not touch. `npx vitest run` in packages/brumate: 1292 passed. packages/ui: 772 passed. `token-field-sync` and `form-reset` failed once each under load in a ui run and pass alone, on main and on the branch.
