# Outcome: streamed-memo-reads

## Built

- Compile error BRM182 (`packages/brumate/src/pending-reads.ts`, called from `analyze.ts`, entry in `error-catalog.ts`): a handler, a handler prop of a component, or a `$client` callback, and the functions of the same script that they call, that reads a memo that can lack a value is an error at the read. A memo can lack a value when it is async or reads an async memo, and is not declared with `await $memo(…)`. A read is fine after a `$isPending` guard on the memo or on a memo that reads it, in the same function: an earlier `if (…) return/throw`, `if (!…) { … }`, the else of `if (…)`, `?:`, `&&` and `||`.
- Runtime (`updates.ts`, `handlers.ts`, `resume.ts`, `components.ts`, `state.ts`): a handler or a `$client` callback that reads a slot the page knows is loading (a streamed or browser-rendered promise, kept in `loadingValues`) throws an error into the nearest `#try`. Any other promise in a slot is a value. The error has no memo name, since the browser does not know names.
- Effects skip a run that reads such a slot, and run again when its promise settles (`NotReady.source`), unless a change ran them first. Memos are unchanged.
- `$client` compiles to `$$b.effect(…, 1)` and is treated like a handler. Two codegen snapshots changed.
- `setSlots` settles the slot from the render promise of a browser-created memo (reviewed as correct).
- Docs: async-data.md ("Reads while a memo is pending"), effects.md, errors.md (both copies), decisions.md. Changeset: brumate minor.
- Tests: `diagnostics.test.ts` (errors and every guard form), `resume.test.ts` (effect, guarded handler, handler prop, unit tests of the client API for the throw, `$client`, rerun, and pass-through, and the browser-created memo).

## Deviations

- Edited `components.ts`, `handlers.ts`, `resume.ts`, `state.ts`, `analyze.ts`, `model.ts`, `error-catalog.ts`, `codegen/client.ts`, `pending-reads.ts`, the errors.md files, `docs/decisions.md` and two fixtures (`optimistic.brm` now checks `$isPending`), as the new design needs.
- The cases "handler prop clicked in the child" and "child effect through a function prop" are partly unit tests: a prop site that reads a memo makes the server wait for it, so a streamed memo cannot reach a function prop in a compiled page.

## Gotchas

- `await $memo(…)` in a component the browser renders yields the promise, not the value (the render function is sync, so the `await` is dropped). The compiler exempts awaited memos anyway, so a handler read of one in a browser-rendered component is not caught.
- A signal whose value is a promise that the server streamed is also treated as loading.
- Any `$client` now ships `, 1` more.

## Proposed learnings

- None.

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass.
- `npx vitest run` in packages/brumate: 1186 passed. `pnpm --filter website check:samples`: 65 samples, 0 problems. `brumate check --no-types` on packages/ui: no errors.
- `pnpm bench` not run.

## Size

- Estimated M, actual L.
