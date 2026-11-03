# Outcome: search-params

## Built

- `$searchParam(name, options)` in `brumate/signals` (types in `packages/brumate/src/runtime/signals.ts`). Options: `default`, `parse`, `serialize`, `history: 'push' | 'replace'`, `server`.
- Runtime: `runtime/search-params.ts` (read and write of a parameter, server `searchParam`), `runtime/client/search.ts` (`searchParam`, `paramEffect`, history follow), exported from `server.ts` and `client.ts`.
- Compiler: `analyze.ts` declares a signal with `declaration.searchParam` and two sites on the call (an effect that writes the URL, a `$client` on `load` that registers it); `codegen/patch.ts` and `codegen/rewrite.ts` emit the calls.
- Feature flag `searchParams` (`features.ts`, `runtime/features.ts`); `loader.ts` asks `Symbol.for('brumate.search')` on popstate, and listens to `brumate:search` to keep its `page` current.
- Docs: "State in the URL" in `website/docs/navigation.md`; skill reference `skills/brumate/references/signals.md`. Changeset `.changeset/search-params.md` (minor). PR #440 (draft).

## Deviations

- Touched files outside owned/shared: `src/model.ts`, `src/codegen/patch.ts`, `src/codegen/rewrite.ts`, `src/runtime/loader.ts`, `src/runtime/client/search.ts` (new), `skills/brumate/references/signals.md`. All needed by the design.
- `onPassEnd` of the update-pass contract not built: effects already run as one pass, and a microtask merges their URL writes. No change request.
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
- Not run: `node e2e/run.mjs` (no browser test for the history yet).

## Size

- Estimated M, actual M.
