# Outcome: state-dedupe-spike

Verdict: **go**. All three gates pass. The prototype does not blank strings. It leaves long raw HTML out of the state record and reads it back from the markup, so every render in the browser gets the same HTML. The maintainer decides go or no-go.

## Built

- Branch `experiment/state-dedupe-spike`, cut from `batch/brumate-release-0.10` at 1f328c06. The prototype commits stay on the branch:
  - ff2e8618: prototype and tests.
  - e01a1fc0: case B measurement and test.
  - d76ef9ef: lazy children fix and the updated codegen snapshot.
  - The final commit reverts them. Only this node folder lands.
- How it works:
  - Server, `insert` (`runtime/server.ts`): a raw value of 256 or more chars is printed between `<!--d{token}-->` and `<!--/d-->` when the compiler passed the new flag. The token is 4 random chars of the render plus a count. This applies only on the page context, not in `#loading` or `#defer` bodies. Children and template output are left out. The value must hold no `d` marker, and `balanced()` must pass: every tag closes in order and no stray `<` is left.
  - The record: `Context.printed` (a WeakMap) maps the raw object to its token. While the page record is serialized, `RawPlugin` writes `$b.d("token")` in place of `$b.r("...")`. A promise record that settles later still writes `$b.r`.
  - Compiler, `codegen/markup.ts`, `printable()`: it passes the flag only when the parent is a flow container (`div`, `article`, `section`, `main`, `aside`, `nav`, `header`, `footer`, `figure`, `figcaption`, `blockquote`, `details`, `dialog`, `body`, `fieldset`, `search`) or the component root. No ancestor may be raw text, a table part, `select`, `template`, `pre`, `svg`, `math`, `a` or `form`.
  - Browser: a record that holds `$b.d(` starts with `READ_PRINTED`, an inline function of about 600 B raw. It runs while the page parses, before any `#loading` swap or client code. It reads each range as the browser serialized it (`outerHTML`, escaped text, comments) into `self.$bP` and removes both markers. `stateValues.d` takes the HTML from there, and falls back to a walk of the page (`printedHTML` in `runtime/html.ts`).
- Scripts in `scripts/`:
  - `strings.mjs`: the long strings of a page's state, and whether the markup prints them.
  - `ceiling.mjs`: the page with every printed string blanked.
  - `bytes.mjs`: raw, gzip and brotli bytes of two builds.
  - `throttled.sh`: step 1.
  - `compare.sh` with `nav-side.sh`: step 3, through perf-pass `bench.py`.
  - `summary.mjs`: summarizes the JSON files of the harness.
  - `check-pages.mjs`: a Chrome check of the built pages.

## Result

- result: **met**. Gate 1, gate 2 and gate 3 pass.

### Gates

| Gate                    | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Every way, same HTML | pass   | `test/state-dedupe.test.ts` (ff2e8618) runs each way twice: on a page whose state holds `$b.d` and on one rendered with `printed: false`. It compares the body HTML, without scripts, after each step. The steps are `#if` closed and opened, `#key`, a changed prop that renders a child's `#key`, the same change reloading a `$memo` of a server function under `#loading`, a store from a context, `refresh()` of a server function with `#loading`, and a second root added after the first, as a navigation does. All are equal, and the last page shows the HTML in all 7 blocks. A raw printed first in a `<span>` or a table cell, and an unclosed `<section>`, stay in the state and render the same. |
| 2. 15% smaller gzip     | pass   | Full navigation response, gzip, from the harness: `/docs/context` docs-server 32 564 -> 25 750 B (-20.9%), docs-static 33 371 -> 26 552 B (-20.4%). `/ui/dialog` ui-server 42 214 -> 34 765 B (-17.6%), ui-static 43 089 -> 35 666 B (-17.2%). Against the release/0.9 figures of partial-measure (d713634e: 32 477, 33 232, 42 432, 43 238 B): -20.7%, -20.1%, -18.1%, -17.5%.                                                                                                                                                                                                                                                                                                                                 |
| 3. brumate test suite   | pass   | `pnpm --filter brumate test` on d76ef9ef: 124 files, 3612 tests pass. One file snapshot changed (`render/blocks.txt`, the new argument of `insert`), and it is updated in that commit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Step 1: throttled navigation of today's full page (restart condition of partial-route-responses)

Build of 1f328c06. `node benchmarks/navigation/run.mjs --no-build --runs 20 --pairs docs-server,ui-server,docs-static,ui-static --network <fast4g|slow4g> --cpu 4 --gzip`, three rounds (`scripts/throttled.sh`). Chrome 158, 8 CPUs. Swap time from click to swap in ms, median / p90 of 20 runs. The load column is the median 1-minute load average of the runs.

| pair        | Slow 4G r1   | Slow 4G r2   | Slow 4G r3   | Fast 4G r1   | Fast 4G r2   | Fast 4G r3   |
| ----------- | ------------ | ------------ | ------------ | ------------ | ------------ | ------------ |
| docs-server | 1223 / 2244  | 876 / 1006   | 883 / 1028   | 402 / 1278   | 376 / 1120   | 345 / 412    |
| ui-server   | 1283 / 3048  | 956 / 1079   | 941 / 1183   | 395 / 702    | 451 / 972    | 381 / 472    |
| docs-static | 4345 / 5338  | 3689 / 4018  | 3696 / 4063  | 877 / 1517   | 834 / 1464   | 672 / 890    |
| ui-static   | 3955 / 5395  | 3224 / 3435  | 3215 / 3631  | 945 / 1307   | 895 / 1083   | 884 / 967    |
| load median | 17.0 to 18.6 | 14.2 to 16.8 | 12.3 to 12.5 | 20.2 to 21.2 | 19.5 to 20.5 | 18.3 to 19.5 |

- On a server, Slow 4G: about 0.9 s. About 580 ms of it is the wait for the first byte, which is the profile's 562 ms RTT, so a smaller response cannot remove it.
- On a static host (the website's real deployment), Slow 4G: 3.2 to 3.7 s. The read takes 2.0 to 2.4 s of it.
- Fast 4G: 0.35 to 0.45 s on a server, 0.67 to 0.94 s static.
- The restart condition asks whether the wait is one a person would notice. By the usual 1 s mark: on Slow 4G, yes for the static pairs and about at the mark on a server. On Fast 4G, no on a server.
- Partial responses would not reach the static website, which is the case with the long waits (partial-measure, Gotchas).
- The maintainer decides whether this restarts the story.

### Step 3: the prototype, throttled, against the base

`scripts/compare.sh` runs perf-pass `bench.py`: 5 measured samples per side and 1 warmup, base and prototype taking turns. Each sample is the swap median of 10 navigations. A change is real when it is larger than 3x the larger MAD.

| pair, network       | base median (MAD) | prototype median (MAD) | change | bench.py     | load at start |
| ------------------- | ----------------- | ---------------------- | ------ | ------------ | ------------- |
| docs-server Slow 4G | 865 (28.5)        | 785 (5.9)              | -9.3%  | within noise | 4.8           |
| ui-server Slow 4G   | 890 (1.8)         | 849 (6.2)              | -4.6%  | better       | 2.4           |
| docs-server Fast 4G | 287 (18.8)        | 266 (1.7)              | -7.4%  | within noise | 2.3           |
| ui-server Fast 4G   | 313 (15.0)        | 292 (5.2)              | -6.7%  | within noise | 3.7           |
| docs-static Slow 4G | 3545 (3.2)        | 2918 (4.0)             | -17.7% | better       | 6.0           |
| ui-static Slow 4G   | 3181 (35.7)       | 2641 (41.7)            | -17.0% | better       | 12.0          |

The brief counts a timing within noise as missed. Three of the six are within noise, all on a server, where the RTT wait dominates. The static pairs, the website's real deployment, are 0.5 to 0.6 s faster on Slow 4G. Timing is not a gate.

### Bytes and first load

| page (static build) | raw                         | gzip                      | brotli (q11)              |
| ------------------- | --------------------------- | ------------------------- | ------------------------- |
| `/docs/context/`    | 196 070 -> 138 146 (-29.5%) | 33 371 -> 26 552 (-20.4%) | 24 605 -> 21 974 (-10.7%) |
| `/ui/dialog/`       | 326 702 -> 221 166 (-32.3%) | 43 089 -> 35 666 (-17.2%) | 31 781 -> 28 288 (-11.0%) |
| `/docs/styles/`     | 158 240 -> 117 191 (-25.9%) | 29 217 -> 24 196 (-17.2%) | 22 099 -> 20 039 (-9.3%)  |
| `/ui/button/`       | 236 287 -> 172 001 (-27.2%) | 36 832 -> 31 634 (-14.1%) | 28 994 -> 26 033 (-10.2%) |
| `/docs/components/` | 212 430 -> 151 688 (-28.6%) | 33 563 -> 27 224 (-18.9%) | 25 186 -> 22 394 (-11.1%) |
| `/`                 | 98 240 -> 98 377 (+0.1%)    | 20 157 -> 20 188 (+0.2%)  | 17 061 -> 17 074 (+0.1%)  |

- The first load gets these same HTML bytes, since the navigation response is the full page.
- The state record of `/docs/context` drops from 72 355 to 14 248 B raw. On `/ui/dialog` it drops from 134 882 to 28 997 B.
- The ceiling, with every printed string blanked (`ceiling.mjs`), was -22.8% and -18.8% gzip. The prototype reaches most of it.
- Brotli saves about half as much as gzip. Its window already finds the far copy, and gzip's 32 KB window does not. A host that serves brotli gets about -11%.
- The home page grows 31 B gzip: markers around HTML that its state does not hold.
- todos, `pnpm bench --only brumate --scenario todos`: gzip JS before `load` is 14 927 B on the base (load 13.5 at start) and 15 176 B on the prototype (load 8.1), so +249 B. The fallback walk `printedHTML` and `stateValues.d` sit in the shared core and are not pruned by use. Size is recorded, not a gate.
- Commands: `node scripts/bytes.mjs .scratch/dist-base website/dist /docs/context/ ...` and `node benchmarks/navigation/run.mjs --check --no-build --pairs docs-server,ui-server,docs-static,ui-static` (all `ok`, swap `routes`).

### Step 2: safety analysis

- What leaves the state: only raw HTML (a `Raw` object), not plain strings. Strings are primitives that seroval writes itself, and the printed text strings are small: 2.5 KB on `/docs/context`, none on `/ui/dialog`.
- What a value is: the browser never sees a blank. Each `$b.d(token)` is a `Raw` of the HTML that the browser parsed from the same bytes. So the question is not which renders read the value but whether the read-back equals the original.
- What can go wrong, and the rule for each:
  - The range moves or splits while the page parses. Rule: `printable()` (the parent is flow content, with no ancestor the parser treats specially) and `balanced()` (the HTML closes every element in order). HTML that fails either stays in the state as `$b.r`.
  - Client code or a `#loading` swap changes the range before the read. Rule: `READ_PRINTED` runs in the record script while the page parses. The page's markup is before that script, and the swap scripts come after it.
  - The range is not in the document when the record runs: a `#loading` or `#defer` body is in a `<template>`, and the `#try` undo drops markup. Rule: only the page context marks values, and an undo removes its entry from `printed`.
  - An old page's markers meet a new page's tokens after a navigation. Rule: the reader removes the markers it reads, and each render has its own random prefix.
  - The read-back is not byte-equal (attribute quotes, entities, `&nbsp;`). It is the browser's serialization of the same parse. Inserting it again gives the same DOM, and the tests compare `innerHTML`.
- The ways a block renders again, and the test step for each:
  - A changed prop: the Child step.
  - `#key`: the Page step and the Child step.
  - A `#loading` reload: the `tens` memo.
  - A refresh: `bump` calls `refresh(stamp)`.
  - A store or context change: the Reader step.
  - A client navigation that keeps a region: the second root in the test, and the real swap in `run.mjs --check`.
  - A fresh render of a component from its render module computes from props and modules, not the old state, so it never reads a read-back value.
- DocPage (the brief's question):
  - The route key of `/docs/[page]` holds the params: `<!--R11:children:13:%2Fdocs%2F%5Bpage%5D%2Findex%20%7B%22page%22%3A%22context%22%7D-->`.
  - So `plan` (`runtime/navigate.ts`) never keeps that region across a change of `page`. `slug` changes only through a navigation that replaces the region and drops its scopes (`b-drop`).
  - With the read-back this does not matter: the rule holds for any prop change.
- Browser check, `scripts/check-pages.mjs` (Chrome, static preview) on `/docs/context`, `/ui/dialog`, `/docs/components` and `/ui/button`: 0 errors, 0 markers left, `self.$bP` empty. On the docs pages, editing a live sample updates its highlighted backdrop. That backdrop is a value read back from the page.

### Case B (not part of gate 2)

`b-base.brm` of server-components-spike, with today's 1560 rows (the spike had 1518). The test is in e01a1fc0. Its render is a test render, not the spike's Vite build.

- HTML + state, gzip: 47 485 B, against the spike's 47 971 B.
- The prototype changes nothing here: 47 485 B. The rows are short strings in text and in an `href` template, not raw HTML.
- Rebuilding from the markup: not possible. The key `row.id` is not printed, and `row.page` appears only inside a template literal.
- Keys only: the keyed diff (`list` in `client/lists.ts`) reads the old items only as `key(item.i)`, and `assign` sets the new row on items that stay.
  - The test cuts each row of the memo's first value to `{id:N}`: 36 101 B gzip (-24%), state 121 310 -> 51 523 B raw.
  - The test stars a row, then types a search: the HTML is the same as with the full rows, and the star stays.
  - The spike's server component reached 27 520 B. The rest of the state is the scopes of the rows and their `RowButton`.
- Answer: the first value can be cut to its keys, but not safely in general. Only the compiler can know that no client code reads the other fields: a `$memo` read only as the list of one keyed `#for`, by key. It is a field-read rule the compiler does not have today. It belongs in the build node only as a follow-up, not in its scope.

## Proposed build node (go)

`state-printed-html` (M): leave raw HTML that the page printed out of the page state, as the prototype does. It adds no API.

- Files:
  - `packages/brumate/src/runtime/server.ts`: `printRaw`, `balanced`, `READ_PRINTED`, the `printed` map and its undo, and setting it around the page record.
  - `src/runtime/serial.ts`: `RawPlugin`, writing `$b.d`.
  - `src/runtime/shared.ts`: `stateValues.d`.
  - `src/runtime/html.ts`: take the value from `self.$bP`, and drop the fallback walk, since the inline reader covers every page record.
  - `src/codegen/markup.ts`: `printable()` and the flag argument.
  - `src/features.ts`: prune `d` when no component prints raw HTML.
  - Tests: `test/state-dedupe.test.ts` and its fixtures, moved in.
- Also in the node:
  - Seeded tokens. Make the prefix a counter seeded by the render base and the route, so a static build is deterministic, and add a test that prerendered output is stable.
  - A dev-mode error naming the component when a range has no end.
  - A note in `website/docs/reference-serialization.md`.
- Cost: about 0.3M tokens (the debate's budget). Size: +about 250 B gzip of client core before pruning, 0 B for pages without raw HTML once pruned.

## Deviations

- The brief asks for blanking with a safety rule. The prototype reads the value back from the page instead, because blanking needs a field-level read analysis that the compiler does not have: DocPage's `part` is read whole for `'files' in part`. The read-back keeps every render correct by construction, so step 2 became a question of when the read-back is exact.
- Only raw HTML is left out, not plain strings.
- My worktree did not exist when I started, so I created it from `batch/brumate-release-0.10` at 1f328c06. The batch moved on later, so the final commit reverts to 1f328c06, not to the newer batch head.
- Step 1 and step 3 ran with `--gzip` (the server compresses, as a host does). The brief names only the network and CPU profiles.
- Step 3 compares through `bench.py` with 5 samples of 10 navigations each, not 3 rounds of 20, to keep the bench lock short.
- Case B was measured in a test render, not the spike's Vite app.

## Stubs left

- `RenderOptions.printed` (`false` turns the feature off) exists only for the tests' comparison. The build node can keep it as a test option or drop it.
- The fallback DOM walk in `runtime/html.ts`. See the build node.

## Gotchas

- `isRaw` is true for children (`Children` objects) before they render, with no HTML. Marking must come after the lazy branch of `insert`. The first website build crashed on this.
- An updated `packages/brumate/dist` is needed before a website build. A stale dist built a website without `READ_PRINTED`.
- A raw printed first in a non-printable place (a `<span>`, a table cell) is not marked there. A later printable print of the same object is the one the record reads.
- Random token prefixes make the prerendered HTML differ between builds, in the markers only.
- The harness's `static` pairs read the full page slowly (2 to 2.4 s on Slow 4G). That is where the saving shows in time.

## Proposed learnings

- Leaving a value out of the page state is safe only if the browser can rebuild it exactly or the compiler proves no client code reads it | the compiler tracks reads per declaration, not per field (DocPage reads `part` whole) | packages/brumate/src/runtime | yes (a resume test against a `printed: false` page)
- Markup that a record reads back must be read while the page parses | `#loading` swaps and client code change the DOM before the core starts | packages/brumate/src/runtime/server.ts | yes

## Verification

- `pnpm --filter brumate test` on d76ef9ef: 124 files, 3612 tests pass.
- `pnpm --filter brumate typecheck` and oxlint on the changed files: pass on ff2e8618. Only existing warnings remain.
- `pnpm build`, then `pnpm --filter website build` on the prototype: pass.
- `node benchmarks/navigation/run.mjs --check --no-build --pairs docs-server,ui-server,docs-static,ui-static`: 4 `ok`.
- `node docs/roadmaps/brumate/nodes/state-dedupe-spike/scripts/check-pages.mjs /docs/context /ui/dialog /docs/components /ui/button`: exit 0.
- `sh scripts/throttled.sh` (base) and `sh scripts/compare.sh <perf-pass bench.py>`: numbers above.
- Not run: `node e2e/run.mjs` and the root `pnpm test` (no product code lands from this node).

## Size

- Estimated M, actual M (about 0.35M tokens of the 0.4M box).
- Risk estimated medium, measured medium. The parse-time reader and the children case were the two surprises.
