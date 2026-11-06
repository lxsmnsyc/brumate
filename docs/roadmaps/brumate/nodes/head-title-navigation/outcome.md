# Outcome: head-title-navigation

## Built

- `navigate()` in `packages/brumate/src/runtime/navigate.ts` now shifts the scope IDs in `next.head` as well as `next.body`. A `<title>` of `#head` that reads a memo keeps its binding when the client router loads a prerendered page.
- Unit test in `packages/brumate/test/navigate.test.ts`.
- e2e step in `e2e/suites/tracker.mjs` with the routes `/titles` and `/titles/other` in `examples/tracker`, which prerenders both. Changeset `.changeset/title-head-prerendered-navigation.md` (patch).

## Cause

- Issue #467 happens on prerendered pages only. A static file renders its scope IDs from 0, so the router shifts the IDs of the new page above those of the live page. The shift skipped the head, where `#head` markup keeps `b-b` anchors.

## Deviations

- The brief names `titles.ts`, `page.ts` and `insert.ts`. The cause is in `navigate.ts`, which the brief did not list.
- `examples/tracker` gains two routes and two prerender paths, for the e2e step. `examples/todos` is unchanged.

## Stubs left

- None.

## Gotchas

- Pages that render on each request do not reproduce it, because the server starts their IDs above the live page.
- Comments in the head (`<!--P2-->`) are not moved by `updateHead`, which copies elements only. Not a cause here.

## Proposed learnings

- A runtime change that touches IDs needs a prerendered page in its e2e, since static files ignore `x-brumate-base`.

## Verification

- Unit test fails on main (`expected '1:0' to be '3:0'`), passes on the branch.
- `node e2e/run.mjs --only tracker --no-build`: the new step fails with `navigate.ts` of main, passes on the branch (15 passed).
- Client gzip -9 of `dist/client/**/*.js`: todos 39233 B on main, 39256 B on the branch (23 B from the fix, measured with the example routes in todos; the routes are now in tracker). ui 199061 B before and after.

## Size

- Estimated S, actual S.
