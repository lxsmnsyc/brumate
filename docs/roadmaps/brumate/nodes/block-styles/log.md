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

## Rework: one style path (2026-11-11)

- Probe of the output, before and after. Script (outside the repo) compiles every `.brm` under examples, packages/ui,
  website, e2e, benchmarks and packages/brumate/test/fixtures (697 files) with `compile(source, { filename, path,
  hideNames })` for hideNames false and true, and writes server, client, render, table, css and every part:
  `node dump.mjs <worktree> packages/brumate/src/index.ts <out>`. Base is the branch tip before the rework
  (56bc064b), 1380 outputs and 14 expected errors (fixtures of error tests).
- Result: 1378 of 1380 outputs are byte-identical. Two differ, the `update` part of ColorThumb (dev and build): a
  browser-rendered row in a `<div>` no longer repeats the file's variables. See outcome.md, "Rework". A first try
  that wrote `$$p.id` in `b-v` and dropped the prologue read changed TreeItem and the `styled` render snapshot; both
  were reverted to the old form.
- Style tests: `pnpm --filter brumate exec vitest run test/styles` passes with `test/styles.test.ts` unchanged.
- BRM205 and BRM206 were added on this batch and never released, and the catalog has no retired list, so the entries
  are deleted and the numbers stay unused. BRM207 stays: `#reveal` is a fragment with no scope, not a body.
- Checks at the end: full brumate vitest 3109 passed; failures only under load (`differential-4` ResolveGoneChild and
  refLoop, `inspect` command line, one resume timeout, `render.test.ts` failed to load), and `differential-4`
  (139 tests), render, inspect and resume pass when run alone. lint: no errors. format:check: pass. typecheck: pass.
  `website check:samples`: 69 samples, 0 problems. `node e2e/run.mjs --only website`: 74 passed, 0 failed.
- Bench `pnpm bench --only brumate --scenario todos` (dist rebuilt first): JS before load 13.8 kB gzip, total JS after
  counter, toggle, add 13.8 kB, client JS emitted in dist 27.7 kB. Same as before the rework (13.8 / 13.8 / 27.7).
