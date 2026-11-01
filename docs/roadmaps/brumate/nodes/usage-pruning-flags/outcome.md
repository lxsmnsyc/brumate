# Outcome: usage-pruning-flags

## Built

- Five flags in the feature mechanism, from `nodes/usage-pruning-spike/prototype-flags.patch` with its two review fixes:
  - `packages/brumate/src/features.ts`: `tries`, `fields`, `windows`, `dynamic` and `routes` in `Features`, `noFeatures`, `getFeatures` (the facts), `joinFeatures` and the globals table.
  - `packages/brumate/src/runtime/features.ts`: `HAS_TRIES`, `HAS_FIELDS`, `HAS_WINDOWS`, `HAS_DYNAMIC`, `HAS_ROUTES`.
  - Read in `runtime/client/{errors,resume,inserts,lists,context}.ts` and in the `loader` object of `runtime/client.ts`, which turns `setGlobal` and `updateRoute` into no-ops without `routes`.
  - `packages/brumate/src/vite.ts`: `routes` is on when client navigation is on. It is also on when any script of the app, or of a package it reaches (not brumate's own `dist` and `src`), names `routeContext` or `navigationContext`, or exports all of `brumate/context`. A `.ts` file can pass a route context on under another name, which no compiled component shows (review of #414).
  - The facts: `fields` matches `=$bind#`, `=$set:` and `$$b.binding(`; `routes` matches `routeContext` and `navigationContext` by name; `tries` matches `$$b.caught(` on the server or `export const t` on the client; `windows` matches `$$b.windowList(`; `dynamic` matches `$$b.dynamic(` and `$$b.dynamicNodes(`. The `b-fail` record is read only with `lateMarkup`.
  - No `BRUMATE_SPIKE_ON` switch.
- All five kinds of tests from the spike's "Stubs left":
  1. `test/feature-flags.test.ts`: a true and a false case for each fact, including a binding through rest props, `routeContext` and `navigationContext` from `brumate/context`.
  2. The same file: the fixture check. It compiles every render fixture, renders it as a stream and ties `=$bind#` and `=$set:` to `fields`, `b-catch` to `tries` and `b-fail` to `lateMarkup`, for the flags of the fixture joined with the components it imports. A guard test fails if a marker never appears.
  3. `test/feature-flags-off.test.ts` (new file, happy-dom): pages run with the flags their facts give, and with a flag forced off. A page with every flag off resumes and handles an event; `#try`, typed fields, windowed lists, dynamic tags and routes work with their flags on; with the flag off and the fact ignored, the page breaks in the way the flag controls (`#try` reports to `brumate:error`, typed text is not read), which shows each flag is wired.
  4. `test/features.test.ts`: core builds with each flag on and off. `tries`, `fields` and `routes` are checked by a string only their code holds (`b-catch`, `=$bind#`, `b-params`); `windows` and `dynamic` have none, so the check compares what `features: 'all'` adds to a counter with what it adds to an app that uses the path (2.4 kB and 2.1 kB of raw difference; threshold 500 B). Client navigation keeps `routes`.
  5. `test/features.test.ts`: a build with the default `features: 'used'` of a page with @brumate/ui `Input` and `$bind` keeps the field code (`=$bind#`) in the core.
- Changeset `.changeset/five-flags-prune-runtime.md` (patch).

## Result

Not an experiment node. Size (gzip -9 of the JS a page loads at start; bench figures are `pnpm bench --only brumate --scenario <s> --metrics browser`, `JS before load`):

| Page      | Before (bench) | After (bench) | Before (gzip -9) | After (gzip -9) |         Change |
| --------- | -------------: | ------------: | ---------------: | --------------: | -------------: |
| todos     |        14.5 kB |       13.5 kB |           14,825 |          13,806 | -1,019 (-6.9%) |
| dashboard |        24.2 kB |       23.3 kB |           24,767 |          23,886 |   -881 (-3.6%) |
| rows      |   not in bench |  not in bench |           14,566 |          13,549 | -1,017 (-7.0%) |

The gzip -9 "before" figures are from the spike's base run (same `next` code, same `size.mjs`); the "after" figures come from this branch. The bench has no JS-before-load line for rows, so rows comes from `size.mjs` only. The bench rounds to 0.1 kB. These match the spike's F figures within 5 B (chunk hashes).

## Review round

- `routes` fact: fixed in the plugin (scan of scripts, above), with a build test of a `route.ts` that re-exports `routeContext as pageRoute` under `navigate: false`; it fails without the scan. The `generateBundle` check does not cover it: the core is written at `transform`, before the bundle exists, and the minified chunks no longer carry the names.
- `tries` fact: a test with a `#try` inside `#client` (no `$$b.caught(` on the server) fails when the client half (`export const t = `) is removed.
- ui flake: ui tests run through the Vite dev transform (`isServe`), which keeps every feature on, so the PR changes neither what they load nor their timing. Full ui suite, default workers, idle machine: head 0 of 3 runs failed, next 0 of 3. The earlier failures came with a machine load of 25 and also happened on next (1 of 3). No fix needed.
- Nit (fixture check for dynamic, windows, routes): not done. Those paths write no marker into server HTML, so there is nothing to tie; their facts are covered by the unit cases.
- Sizes after the round: todos 13.5 kB, dashboard 23.3 kB (bench); gzip -9 13,804 / 23,878 / 13,549 (todos / dashboard / rows). A first version of the scan also read brumate's own `dist/runtime/server.js`, which names `routeContext`, and cost +0.1 kB on todos; it skips the package's own `dist` and `src` now.

## Deviations

- `test/feature-flags-off.test.ts` is a new test file; the brief owns only `feature-flags.test.ts` and `features.test.ts`. The runtime tests need the happy-dom environment and stubbed globals, so a file of their own keeps the other two in the node environment.
- Test 5 checks the core chunk of a built page, not typing in Chrome. The runtime half is test 3 with `bindSpread` and `BindField`, which pass a `$bind` through a spread as `Input` does. A Chrome test of `Input` before the core loads would go in `e2e/suites/ui.mjs`, outside this node's paths.
- The windowed-list refactor is skipped: it is not small, and it only removes the `windows` fact.
- The windowed test in `feature-flags-off.test.ts` does not lay out boxes, so it checks that a windowed page resumes and a handler runs, not the scroll windows (`resume.test.ts` covers those with every flag on).

## Stubs left

- None for the flags. The cold paths the spike did not check (`html.ts` helpers, serial plugins, `send`, `withVariables`, about 1.7 kB raw min) are not in this node.

## Gotchas

- The website builds with `features: 'all'` and gains nothing. Any app that uses @brumate/ui keeps `dynamic` on (44 of 107 parts use the `as` prop), and any app that passes a `$bind` to a component keeps `fields` on.
- `ref=$bind(el)` is not a field binding: it does not turn `fields` on.
- A new marker the server writes for a flag must be added to the fixture check, or a miss stays invisible.
- Mutation check: removing `$$b.binding(` from the `fields` fact fails the fixture check on `bindSpread.brm`; turning `tries` or `lateMarkup` off fails it on `streamedCatchTwo.brm` and the reveal fixtures.

## Proposed learnings

- A core path that only some components use gets a flag with a fact from the compiled output, and a test that renders the fixtures and ties each marker the server writes to the flag | a miss is a production break that tests with every flag on cannot see | packages/brumate | yes (`test/feature-flags.test.ts`)

## Verification

- Fast check: `pnpm lint` (0 errors; three `consistent-function-scoping` warnings in the new test file), `pnpm format:check` clean, `pnpm typecheck` clean.
- `vitest run test/feature-flags.test.ts test/feature-flags-off.test.ts test/features.test.ts`: 476 passed.
- `pnpm build`, `pnpm --filter brumate test`: 1,775 passed (after the review round).
- `pnpm test` for the other packages and the website: passed. @brumate/ui: 771 or 772 passed, with at most one failure, `token-field-sync.test.ts > shows the kept value after a refused edit` (the first test of the file, which waits a fixed 150 ms for the code). It fails the same way on `next` without this branch: 1 of 3 runs with `--maxWorkers 2`. Under a machine load of about 25 (the other worker was running), 3 to 7 ui tests failed in the same timing-bound files (Button, bind-kept-writes, token-field-sync) and passed when run alone. Not chased further.
- `node e2e/run.mjs`: all suites passed (ui 55, kit 5, nitro 2, tracker 14, and the rest).
- Mutation checks are in the log.

## Size

- Estimated M, actual M. The prototype applied as is; the tests were most of the work.
