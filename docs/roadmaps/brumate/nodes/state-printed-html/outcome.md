# Outcome: state-printed-html

## Built

The server leaves long raw HTML out of the page state, and the browser reads it back from the markup it printed. This is the prototype of `experiment/state-dedupe-spike` (ff2e8618, d76ef9ef, cherry-picked), with the six fixes of its review.

- How it works:
  - An insert of a `Raw` of 256 or more characters, at a place where the parser keeps it between two comments, prints `<!--d{token}-->HTML<!--/d-->` (`Context.printRaw`, `runtime/server.ts`).
  - The page record writes `$b.d("token")` in place of `$b.r("HTML")` (`RawPlugin`, `runtime/serial.ts`).
  - `READ_PRINTED`, inline in that record, reads each range into `self.$bP` while the page parses and removes the markers. `stateValues.d` takes the HTML from there (`printedHTML`, `runtime/html.ts`).
- Fix 1, the place of an insert:
  - `Emitter.place()` (`codegen/markup.ts`) gives code: `1`, `0`, `$$place && 1` inside an element of the component, or `$$place` at its top level.
  - Components take `$$place` as a third argument (`codegen/server.ts` adds it only when the body reads it). Children bodies take it as the third argument of their render, from the insert that renders them. `#head`, portal and template bodies get `0`.
  - `component()`, `Lazy`, `children()` and `insert()` pass the place on. `render()` starts the root at 2, the top of the page. Route views get the place of the layout's insert (`runtime/route-render.ts`).
  - Only place 1 marks. Children whose HTML the state holds (no browser export) render with 0, so that HTML carries no markers.
- Fix 2: navigation reads the ranges of the fetched page with `readPrinted(next.body)` into a fresh `$bP` before `replaceRoutes` (`runtime/navigate.ts`). Kept layouts keep their old markup, so their new tokens are never needed.
- Fix 3: `balanced()` refuses a `<pre>`, `<textarea>` or `<listing>` whose text starts with a newline, and a `<template shadowrootmode>`.
- Fix 4: after the page record, `render()` removes the markers of tokens that the record did not write (`unmark`). `READ_PRINTED` goes only in a record that holds `$b.d(`. The home page has 0 markers.
- Fix 5: the feature `printed` (`features.ts`, `__BRUMATE_HAS_PRINTED__`, set by the emit in `plan.printed`) prunes `stateValues.d`, `printedHTML` and the navigation reader. `stateValues.d` is added only when the feature is on, so a build without it carries no key. The fallback walk of the page is gone.
- Fix 6:
  - The 4 characters of the tokens are an FNV-1a of the route and the base (`printedPrefix`), so the same page gets the same markers.
  - In development the record writes `$b.d(token, component)`, and the browser's error names the component: "The raw HTML that X printed (token) has no end in the page...".
  - Both readers stop at the next start marker, so a start without an end cannot take the next range.
- Tests: `packages/brumate/test/state-dedupe.test.ts`, 13 tests, with fixtures in `packages/brumate/test/state-dedupe/`.
  - Review case 1: `InChildren.brm` (`<Link>{doc}</Link>` in a `#key`, Link renders `<a>{children}</a>`, and `<Box>` in a `<div>`), `InTemplate.brm` (`<template><div><Wrap doc=kept/></div></template>`), and a compile test for `#head`, a template body, `<a>` and `<p>`.
  - Review case 2: `NavLayout.brm`, `NavA.brm` and `NavB.brm` through `handleRoute` and a real link click, so `navigate` and `replaceRoutes` run. Without the fix it throws `The page has no printed HTML h4w3.0`.
  - Review case 3: `Refused.brm`.
  - Review case 4: `Unused.brm`.
  - Review case 5: the compile test also checks that the todos app of the benchmark (`benchmarks/brumate/src`) has no marked insert.
  - Review case 6: same markers on two renders of the same route, different on another route, the dev name in the record and in the error, and the stop at a second start, for both readers.
- `.changeset/state-printed-html.md`, minor.
- Fixes of the PR review (#539, 2026-11-27):
  - B1: a render in order (crawlers, `inOrder`) sets no `ctx.printed`. Its `#catch` bodies replace markup on the server with `replaceBlock`, which ended a block at `<!--/d-->` and left `$b.d` naming a range that is gone. Counting `d` markers there would also need the replaced values dropped from the record that is already written. Crawlers gain nothing from a smaller state, so the simpler rule is the safe one. A streamed `#catch` swaps in the browser after the record read the range, so it keeps the saving.
  - S1, S3, N1: `balanced()` (through `LOST_IN_PARSE`) refuses `<html>`, `<head>`, `<body>`, `<frameset>`, `<script>`, and a lone `\r` after `<pre>`.
  - S2: `NOT_PRINTABLE` holds `li`, `dd`, `dt`, `button`, `nobr` and `p`. A start tag of raw HTML closes these from inside a `<div>` (the `li`/`dd`/`dt` rule walks through `div`, `address` and `p`; `button` and `nobr` close one in scope; a block closes a `<p>`). The ruby tags only generate implied end tags under the `<div>`, which closes nothing above it.
  - N2: before the page record is serialized, `dropCopiedTokens` counts the start markers of each token in the head and the page. A token that shows more than once leaves `printed.tokens` (through `printed.values`), so the record writes its HTML, and `unmark` removes every copy of its markers. This holds with the copy before or after the real range (the follow-up review showed that first-read-wins alone loses when the copy comes first). Both readers also keep the first range of a token.
  - Chrome: the suite `printed` of `e2e/run.mjs` (`e2e/suites/printed.mjs`) compiles probe components with the built package and checks the cases in Chrome. For each refused case it also serves the same HTML between markers, which shows that Chrome moves the end marker (`<html>`/`<body>`, `<button>`, `<li>`) or that the script changes the range.
  - Docs: "Raw HTML that the page printed" in `website/docs/reference-serialization.md`.
  - Bytes after the fixes, gzip level 9 of the website build of the e2e run: `/docs/context/` 26 584 B (-20.3% against the base 33 373 B), `/ui/dialog/` 35 697 B (-17.2% against 43 096 B), `/` 20 149 B.

## Proof

- base 6fa90cdc, `node docs/roadmaps/brumate/nodes/state-dedupe-spike/scripts/bytes.mjs <base>/website/dist website/dist ...`, gzip of the full page, which is the navigation response:

| page                | base gzip | branch gzip | change |
| ------------------- | --------- | ----------- | ------ |
| `/docs/context/`    | 33 373    | 26 582      | -20.3% |
| `/ui/dialog/`       | 43 096    | 35 696      | -17.2% |
| `/docs/styles/`     | 29 222    | 24 225      | -17.1% |
| `/ui/button/`       | 36 839    | 31 667      | -14.0% |
| `/docs/components/` | 33 567    | 27 251      | -18.8% |
| `/`                 | 20 156    | 20 162      | 0.0%   |

- Raw: `/docs/context/` 196 069 -> 138 175 (-29.5%), `/ui/dialog/` 326 701 -> 221 195 (-32.3%). Brotli: -10.7% and -11.2%.
- These match the spike (-20.4% and -17.2%), so the stricter places cost nothing on the website.
- todos, `pnpm bench --only brumate --scenario todos`, JS before `load`: base 36 222 B raw / 14 921 B gzip, branch 36 222 B raw / 14 923 B gzip. The core chunk is 27 637 B on both sides. The 2 B of gzip are the chunk hashes in the import paths. With `d: unused` still in the object literal it was 36 225 / 14 927.

## Deviations

- `packages/brumate/src/runtime/route-render.ts`: route views pass the place of the layout's insert to the page component. Without it no page of the website would mark.
- `packages/brumate/src/plan.ts`: `Plan.printed`, which the emit sets, as for `viewTransitions`. A regex on the server code could not tell an insert from a component call.
- `packages/brumate/src/runtime/features.ts`: `HAS_PRINTED`. The brief lists `src/features.ts` only.
- The brief names `src/serial.ts`, `src/shared.ts` and `src/html.ts`. The files are in `src/runtime/`.
- `packages/brumate/test/__snapshots__/render/*.txt`: 5 snapshots take the new `$$place` argument and the place of inserts and component calls.
- e01a1fc0 (the case B measurement of the spike) is not ported: it holds no product code.
- `website/docs/reference-serialization.md`, `e2e/run.mjs`, `e2e/README.md` and `e2e/suites/printed.mjs` are outside the brief's paths. The PR review asked for the docs note and the Chrome cases.

## Stubs left

- `RenderOptions.printed` (`false` keeps the HTML in the state) stays as a test option. The tests compare against it.

## Gotchas

- A component that is not called through compiled markup (a dynamic tag, `component()` without a place, a custom caller) renders with no place, so it marks nothing. That is safe but leaves its HTML in the state.
- Children without a browser export (their HTML goes into the state as `$b.r`) render with place 0.
- The test DOM (happy-dom) does not move nodes for nested `<a>` as Chrome does. The place tests check the markup and the state, not the parse.
- A browser extension that changes the DOM while the page parses would change the read-back (review item 6). Not tested.
- `vitest` under the load of other workers times out many tests (32 failures in one full run). Each failed file passes on its own. `module-signals.test.ts` "loads again when a source changes" also fails on the base under load.

## Proposed learnings

- A place in the page that the compiler cannot see (the root of a component, children) comes from the caller as an argument, not from state on the render context | renders on one context can interleave (arrays of children, streamed bodies) | packages/brumate/src/codegen | yes (InChildren and InTemplate tests)
- A value left out of a state record must be read before a navigation drops the page it came in | `replaceRoutes` keeps the old layouts and drops the new copies | packages/brumate/src/runtime/navigate.ts | yes (the navigation test of state-dedupe)

## Verification

- `pnpm --filter brumate exec vitest run test/state-dedupe.test.ts`: 14 pass after the review fixes. The in-order test fails without the B1 fix with the reviewer's output.
- After the review fixes: `state-dedupe`, `render`, `features`, `navigate`, `routes`, `resume` and `differential*` test files, 1 269 pass. `node e2e/run.mjs --only printed --no-build`: 11 ok.
- `pnpm --filter brumate test` (full): the snapshot file `render.test.ts` updated with `-u` (5 snapshots). The other failures were timeouts under load. A rerun of each failed file alone passes (1 120 tests). `test/module-signals.test.ts` and `test/styles/style-files-postcss.test.ts` pass together on a third run.
- `node e2e/run.mjs`: 225 `ok` lines, none failed, exit 0. After the review fixes: 11 suites, 215 steps passed, 0 failed, exit 0.
- `node benchmarks/navigation/run.mjs --check --no-build --pairs docs-server,ui-server,docs-static,ui-static` (Chrome): 4 `ok`, swap `routes`.
- `pnpm build`, `pnpm --filter website build` on the branch and on the base.
- `pnpm lint`: no errors. `pnpm format:check`: pass. `pnpm typecheck`: pass.

## Size

- Estimated L, actual L. The place had to reach components, children and route views, not only the insert.
- Risk estimated high, measured medium. The read-back holds by construction, and every unknown place now defaults to no marker. The remaining risk is a parse quirk the tests' DOM does not show.
