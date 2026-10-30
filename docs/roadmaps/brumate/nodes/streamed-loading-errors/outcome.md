# Outcome: streamed-loading-errors

## Built

- An error inside a streamed `#loading` or `#defer` body reaches the nearest `#catch`, in the body or around the block.
  - Inside: the deferred body waits for its memos with `awaitHeld` (`markup.ts`), and `bodyMemos` (`scopes.ts`, used in `server.ts`) makes the markup read them in place, so the `#try` inside the body gets the error. Before, the wait threw outside the `#try` and the whole body failed.
  - Around: when a body fails, `render()` in `runtime/server.ts` sends a state record with `b-fail="<boundary>"` whose code is the error (`caught()`: real in development, generic and logged in production). `readRecord` (`client/resume.ts`) hands it to `failBoundary` (`client/errors.ts`). It walks the block markers around the boundary, finds the first `#try` with a `#catch` in the browser (`t` table) and renders it with `catchInto`. Without one, `brumate:error` fires.
- A stream that ends early: after client navigation, `failPending` (`navigate.ts`) fails every `<!--lN-->` boundary that still shows its fallback (not a `#defer`), through the same record. Message: `The page stopped loading before this part arrived`.
- Docs: `website/docs/async-data.md` ("When a value fails", "When the stream ends early"). Changeset: brumate patch.
- Tests: `resume.test.ts` "an error inside a streamed #loading body" (6, five fail on main), `navigate.test.ts` (stream ends before the body), `codegen.test.ts` and two render snapshots updated for the held wait.

## Deviations

- Cut stream, chosen behavior: fail the boundaries (not reload) after navigation. A document load cannot detect a dropped connection: Chromium fires neither `DOMContentLoaded` nor `load` (debate O9), so that case stays pending and is documented. A timer would fail slow but healthy bodies.

## Stubs left

- None.

## Gotchas

- A `#try` ships its `#catch` body to the browser only when its body has client code or a memo read (`tryCatchesClient`). A `#try` in a parent that wraps only a child component with the failing `#loading` has neither, so that error ends as `brumate:error` and the fallback stays. Fixing it ships every `#catch` that wraps a component.
- The bots path (`inOrder`) still keeps the fallback of a body that fails, as before.
- A reader that errors during navigation (`read()` rejects) is not handled here.
- The in-place branch of a `#loading` still declares `const x = $$b.read(...)`, now unused since reads are in place.

## Proposed learnings

- None.

## Verification

- `pnpm lint`: 187 warnings, same as main, no errors. `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter brumate test`: 1258 passed. The new resume tests fail on main (5 of 6 by timeout of the wait for the `#catch`).
- `pnpm --filter website check:samples`: 65 samples, 0 problems. `pnpm --filter website build`: pass.
- Todos client JS in dist: 80.2 kB raw / 28.6 kB gzip on main, 80.7 kB / 28.8 kB here (about +0.5 kB raw, +0.2 kB gzip, in the core).

## Size

- Estimated M, actual M.
