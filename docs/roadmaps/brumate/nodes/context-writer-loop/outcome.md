# Outcome: context-writer-loop

## Built

- packages/brumate/src/runtime/client/updates.ts and context.ts: an effect does not run again on a context send that its own run caused. The effect that runs is the origin of its writes, queued updates inherit it, and `queue` skips the origin effect when the update comes from `updateContext`. The context stays live for everything else.
- Tests in resume.test.ts: the loop (fixtures ctxWriterLoop*) times out on main and passes; the probe of the review (fixtures ctxReader*, markup, `$memo` and `$effect` on `ctx.read()`) passes on main and on the branch.
- Patch changeset .changeset/calm-writers-rest.md.

## Deviations

- Added test fixtures under packages/brumate/test/render/, and the fix is in runtime/client (listed as shared); graph.ts is unchanged.

## Stubs left

- None.

## Gotchas

- An effect that reads a context and also writes through it does not run again on its own write, but still runs for any other change of the context.
- The ui suite is flaky under load; compare against main on the same files.

## Proposed learnings

- A context object with a writing function is fixed except for its own values | an effect that reads the context and calls the writer loops otherwise | packages/brumate/src | yes (the resume test)

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "context"`: the loop test fails on main (timeout) and passes; the probe passes on both.
- The compiler is identical to main (only runtime/client changed), so the compiled output of the ui parts is unchanged.
- brumate: 1301 passed. ui (2 workers): 773 passed, 74 files. oxlint, oxfmt --check and typecheck pass.

## Size

- Estimated M, actual S: a few lines in the graph.
