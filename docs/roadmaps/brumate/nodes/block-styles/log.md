# Log: block-styles

## Probe (failing test first)

- Base: 0abbb2ce (batch/brumate-release-0.8, with block-styles-scope).
- Test: `packages/brumate/test/styles/block-styles-live.test.ts`, first case "changes the variable of one row
  after resume, not the others" (a `#for` row with a block script signal read by a block style, changed by a click).
- Command: `pnpm --filter brumate exec vitest run test/styles/block-styles-live.test.ts`
- Result on the base: fail. The server render and the resume work and the click runs the handler, but the client
  has no update function for the block style site (`g = { 2: { 0: [[2, "u4"]] } }` has only the content update), so
  the custom property of the row stays `none`.
- Found while building: the render function of a row gets its scope as a number (`createScope` returns the ID), so
  `b-v` needs the ID itself there and `.id` only for a scope outside the render.

## Cost of setVar for a list (review fix)

- Case: `test/styles/block-styles-live.test.ts`, "updates 1000 rows that share one value": 1000 rows of a `#for`,
  each a `<p>` with 5 children, one block style reading one component signal, a click changes it (happy-dom).
- Before (`setVar` queried `[b-v~="id"]` in the document for each call): 13002 ms for the click to reach 1000 rows.
- After (one index of `b-v` carriers, rebuilt when the page adds, removes or marks elements): 918 ms.
- Design: `page.ts` keeps `Map<id, Element[]>` built by one `querySelectorAll('[b-v]')`. A `MutationObserver`
  (`childList` and `b-v` attribute changes) drops it, and `takeRecords()` in `setVar` catches changes not yet
  reported. Navigation shifts, removed rows, rows the browser adds and component roots all change the DOM or `b-v`,
  so each rebuilds the index once.
