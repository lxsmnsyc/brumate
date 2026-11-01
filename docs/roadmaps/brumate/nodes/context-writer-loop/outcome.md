# Outcome: context-writer-loop

## Built

- packages/brumate/src/graph.ts: a `$setContext` value that holds a function which writes outside `$untrack` (or calls code the compiler cannot see) is sent again only when a value it holds itself changes. Functions in it that read state no longer send it again.
- Test "does not run an effect again on its own write through a context writer" in packages/brumate/test/resume.test.ts, with fixtures test/render/ctxWriterLoop.brm, CtxWriterLoopMid.brm, ctxWriterLoop.ts. It times out on main.
- Patch changeset .changeset/calm-writers-rest.md, and a note in website/docs/context.md.

## Deviations

- Added test fixtures under packages/brumate/test/render/, which the brief lists as shared. Nothing in analyze.ts, codegen or the client runtime changed.

## Stubs left

- None.

## Gotchas

- Markup in a child that calls a reading function of a context that also holds a writer (`{ctx.read()}`) does not update any more. Reading a value held by the object still does. No ui test depends on it.
- The ui suite is flaky under load; compare against main on the same files.

## Proposed learnings

- A context object with a writing function is fixed except for its own values | an effect that reads the context and calls the writer loops otherwise | packages/brumate/src | yes (the resume test)

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "context writer"`: fails on main (timeout), passes.
- brumate: 1299 passed, 1 skipped.
- ui: the failures match main on the same files (bind-kept-writes, generics-markup, skill, token-field-sync); other failures were load flakes that pass on rerun. No part output changed.

## Size

- Estimated M, actual S: a few lines in the graph.
