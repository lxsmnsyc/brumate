# Outcome: search-params

## Built

- `$searchParam(name, options)` in `brumate/signals` (types in `packages/brumate/src/runtime/signals.ts`). Options: `default`, `parse`, `serialize`, `history: 'push' | 'replace'`, `server`.
- Runtime: `runtime/search-params.ts` (read and write of a parameter, server `searchParam`), `runtime/client/search.ts` (`searchParam`, `paramEffect`, history follow), exported from `server.ts` and `client.ts`.
- Compiler: `analyze.ts` declares a signal with `declaration.searchParam` and two sites on the call (an effect that writes the URL, a `$client` on `load` that registers it); `codegen/patch.ts` and `codegen/rewrite.ts` emit the calls.
- Feature flag `searchParams` (`features.ts`, `runtime/features.ts`); `loader.ts` asks `Symbol.for('brumate.search')` on popstate, and listens to `brumate:search` to keep its `page` current.
- Docs: "State in the URL" in `website/docs/navigation.md`; skill reference `skills/brumate/references/signals.md`. Changeset `.changeset/search-params.md` (minor). PR #440 (draft).

## Review fixes

- The load callback no longer rewrites the URL: the effect writes only when the canonical text of the signal differs from the canonical text of the URL's value (`?page=1`, `?q=`, `?page=abc` stay as written).
- Two `$searchParam` of one name in one component: compile error with the existing message `"{name}" is already declared`. Across components, a write also sets the other bound signals of that name (shared value, no warning).
- The options must be an object literal and the call takes at most two arguments; the error reuses `{name} needs a value`.
- Back/forward compares the lists of values item by item; writes edit the query string in place, so other parameters keep their encoding; a repeated parameter keeps its first piece.
- Tests added in test/search-params.test.ts (22 now). The cross-component sharing has no test. E2E: `/tabs` page in examples/todos and a step in e2e/suites/todos.mjs (real Chrome: two pushes, back, back, forward, no request).

## Deviations

- Touched files outside owned/shared: `src/model.ts`, `src/codegen/patch.ts`, `src/codegen/rewrite.ts`, `src/runtime/loader.ts`, `src/runtime/client/search.ts` (new), `skills/brumate/references/signals.md`. All needed by the design.
- `onPassEnd` of the update-pass contract not built: effects already run as one pass, and a microtask merges their URL writes. No change request.
- Added examples/todos/src/routes/tabs.brm, its entry in src/brumate-routes.d.ts and a step in e2e/suites/todos.mjs for the e2e test.
- No new error codes (codes are assigned in brumate-check): errors reuse existing messages (`Declare {name} with {expected}`, `{name} needs a value`).

## Stubs left

- None.

## Gotchas

- `$effect` never runs on mount, so registration for the history uses a `$client` `load` site; a page with `$searchParam` loads its client code at page load.
- Two components binding the same parameter both follow the history; a write by one is not pushed to the other until the next route read.
- A `server: true` parameter is not followed locally: back loads the page.
- A `<a href="#x">` after a write is safe because the write dispatches `brumate:search`, which updates the loader's `page`.

## Proposed learnings

- A feature that must act on resume needs a `$client` load site, since effects skip mount | found while building | packages/brumate/src | no

## Verification

- `pnpm lint && pnpm format:check && pnpm typecheck`: pass. `pnpm build && pnpm test`: pass after fixing two skill-test failures (rerun of skill, search-params, diagnostics, check-command: pass). `pnpm --filter website check:samples`: 65 samples, 0 problems.
- `vitest run test/search-params.test.ts`: 11 pass (server render, replaceState without fetch, push, one change for two writes, popstate, server option, other parameter loads the page, hash after write, bad declarations).
- Bench todos: JS before load 32.4 kB / 13.6 kB gzip, same as `next`.
- `pnpm e2e --only todos`: 10 passed.

## Size

- Estimated M, actual M.
