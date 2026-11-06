# Outcome: prerender-search-params

## Built

- `paramEffect` (packages/brumate/src/runtime/client/search.ts): on the first run of a parameter signal, when the signal differs from `location.search`, the signal takes the URL's value. The URL stays as written and no history entry is added. Later runs write the URL as before. `server: true` parameters keep their navigation rule.
- packages/brumate/src/graph.ts: a `$searchParam` signal without `server: true` is live on the client (`followsUrl`). Before, a parameter that no handler wrote had no client slot, so its readers never updated, on load or on back and forward.
- Tests: packages/brumate/test/search-params.test.ts, "reads the URL on a page rendered without its query string". It covers `page`, `tab`, `query` (bound input), `note` (never written), `location.search` and `history.length`.
- e2e: examples/tracker/src/routes/from.brm, prerendered at `/from`. Step "/from?from=docs" in e2e/suites/tracker.mjs.
- Docs: website/docs/navigation.md. Changeset .changeset/prerender-keeps-query.md (patch).

## Deviations

- The fix touches the compiler graph, not only `search.ts`. The brief's shared paths do not list packages/brumate/src/graph.ts. The issue case needs it.
- Added a page to examples/tracker and a path to its `prerender.paths`, plus the regenerated src/brumate-routes.d.ts.

## Stubs left

- None.

## Gotchas

- A prerendered page with a signal written by client code and a `#defer` body that reads a context shows the signed-out text after load. Seen on examples/tracker `/about` with a `$client` write added. It is not caused by this change and is not fixed.

## Proposed learnings

- A runtime fix for a compiled feature needs a test whose signal has no writer, since the compiler leaves such a signal out of the client.

## Verification

- New test fails on main, passes on the branch. Tracker e2e `/from?from=docs` fails on main, passes on the branch.
- Client size, sum of `gzip -9` of `dist/client/**/*.js`: examples/todos 39239 to 39285 bytes (+46), examples/ui 199062 to 199057 bytes (-5).

## Size

- Estimated S, actual S.
