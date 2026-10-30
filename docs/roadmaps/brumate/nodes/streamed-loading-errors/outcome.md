# Outcome: streamed-loading-errors

## Built

- An error inside a streamed `#loading` or `#defer` body reaches the nearest `#catch`, in the body or around the block.
  - Inside: the deferred body waits for its memos with `awaitHeld` (`markup.ts`), and `bodyMemos` (`scopes.ts`, used in `server.ts`) makes the markup read them in place, so the `#try` inside the body gets the error. Before, the wait threw outside the `#try` and the whole body failed.
  - Around, in the same component or a parent: each `#try` that holds a `#loading` block or a component registers its `#catch` body on the server (`$$ctx.catcher`, `emitCatcher` in `markup.ts`) and gets markers (`holdsStream` in `plan.ts`). A boundary keeps the `#try` blocks around it. When its body fails, `render()` in `runtime/server.ts` renders the nearest `#catch` body in a context of its own and streams it as a `<template b-c>` with a `b-catch` record and the state of the `#catch` body. `replaceTry` (`client/errors.ts`) replaces the `#try` body with it and destroys the scopes in the range. No `#catch` code ships to the browser for this. Without a `#try`, a `b-fail` record makes the core fire `brumate:error`.
  - Readers without scripts (`inOrder`): a failed body renders the same `#catch` in place (`replaceBlock` in `server.ts`).
- A stream that ends early: after client navigation, `failPending` (`navigate.ts`) dispatches `brumate:error` for every `<!--lN-->` boundary that still shows its fallback (not a `#defer`). The fallback stays.
- Docs: `website/docs/async-data.md` ("When a value fails", "When the stream ends early"). Changeset: brumate patch.
- Tests: `resume.test.ts` "an error inside a streamed #loading body" (11, nine fail on main), `navigate.test.ts` (stream ends before the body, no double report, connection failure), `codegen.test.ts` and two render snapshots updated for the held wait.

## Deviations

- Cut stream, chosen by the maintainer: `brumate:error` and the fallback stays, no `#catch`, since the server cannot be asked and the page may not hold the `#catch` code. A document load cannot detect a dropped connection: Chromium fires neither `DOMContentLoaded` nor `load` (debate O9), so that case stays pending and is documented. A timer would fail slow but healthy bodies.

## Stubs left

- None.

## Gotchas

- A `#try` that holds a component now has markers in its HTML, for the server catch (a few bytes each).
- Every `#try` that holds a component or a `#loading` block gets `<!--bS:A-->` and `<!--/b-->` markers in its HTML (`holdsStream` in `plan.ts`), about 25 bytes each, and a closure that registers its `#catch` body on the server. A page with many such `#try` blocks pays for each.
- With `inOrder`, the state of the page is serialized before the bodies. A failed body leaves the scopes of the replaced `#try` body in that state, so a browser that gets an in-order page and a failed body resumes with scopes that have no markup.
- A reader that errors during navigation (`read()` rejects) is not handled here.
- The in-place branch of a `#loading` still declares `const x = $$b.read(...)`, now unused since reads are in place.

## Proposed learnings

- None.

## Verification

- `pnpm lint`: 187 warnings, same as main, no errors. `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm --filter brumate test`: 1276 passed. The new resume tests fail on main (5 of 6 by timeout of the wait for the `#catch`).
- `pnpm --filter website check:samples`: 65 samples, 0 problems. `pnpm --filter website build`: pass.
- Todos client JS in dist: 80.8 kB raw / 28.8 kB gzip on main, 81.1 kB / 28.9 kB here (about +0.3 kB raw, +0.1 kB gzip, in the core).

## Size

- Estimated M, actual M.
