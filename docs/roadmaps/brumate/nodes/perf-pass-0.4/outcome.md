# Outcome: perf pass on 0.4.0

Run on 2026-10-30 at `3bba0c09` (main at the 0.4.0 cut). Apple M2, 8 cores, 8 GB, Node 26.12.1, Chrome 156. Command: `pnpm bench --only brumate,brumate-0.3,marko`, one run, 1,118 s.

The machine was not quiet. Load average was 3.09 4.01 4.05 at the start and 2.79 3.99 4.12 at the end, with other agents running. Treat differences under about 10% in the timings as noise; the sizes are exact. Where a timing looked odd I repeated it alone (noted below).

`brumate` is the workspace package (version still 0.3.0 in `package.json`, so the report prints `brumate@0.3.0` for both columns). `brumate 0.3.0` is `benchmarks/brumate-0.3`, installed from npm.

## brumate 0.3.0 port

`benchmarks/brumate-0.3` is a copy of `benchmarks/brumate` with `brumate@0.3.0` from npm. The pages are the same. Changes:

1. `package.json`: name `bench-brumate-0.3`, dependency `0.3.0`, and `build:dashboard` writes the widgets with `harness/dashboard.mjs brumate-0.3`.
2. `adapter.js`: label `brumate 0.3.0`; 0.3.0 writes `.brumate/hints.json` as a flat list of URLs, 0.4.0 as `{ all, bundles }`, so the adapter reads the list.
3. `harness/dashboard.mjs`: `WRITERS['brumate-0.3'] = WRITERS.brumate`, the same widgets.

No `.brm` file needed a change. Both builds print the same warning: the todos `<input>` has no label (a placeholder is not a label).

0.3.0 loads code lazily (per handler and per component) and 0.4.0 loads the code of the page at start. That is the maintainer's choice (eager client code), so the "before `load`" rows are not like for like: compare the "total after" rows too.

## Three-way tables

Sizes are raw / gzip -9. Medians of 5 (SSR) or 10 (rows).

### Todos

| Metric                                  |     brumate 0.4.0 |     brumate 0.3.0 |         Marko 6 |
| --------------------------------------- | ----------------: | ----------------: | --------------: |
| JS before `load`                        | 36.5 kB / 15.2 kB | 26.4 kB / 11.2 kB | 9.1 kB / 4.4 kB |
| JS fetched while idle 3 s               |               0 B |   1.8 kB / 1.2 kB |             0 B |
| Total JS after counter, toggle, add     | 36.5 kB / 15.2 kB | 28.2 kB / 12.3 kB | 9.1 kB / 4.4 kB |
| Client JS in dist                       | 81.2 kB / 28.9 kB | 71.6 kB / 25.8 kB | 9.1 kB / 4.4 kB |
| SSR HTML, 3 todos                       |    1.5 kB / 712 B |    1.4 kB / 674 B |  1.2 kB / 693 B |
| SSR renders/s, 3 todos                  |           123,473 |           122,223 |         142,812 |
| SSR renders/s, 100 todos                |            12,166 |            12,365 |           8,794 |
| Click to update (counter/toggle/add)    | 138 / 42 / 112 ms |  110 / 54 / 82 ms | 90 / 49 / 79 ms |
| First counter click at load, 150 ms RTT |            117 ms |     199 ms (1 RT) |          100 ms |

### Dashboard (50 widgets)

| Metric                          |      brumate 0.4.0 |      brumate 0.3.0 |           Marko 6 |
| ------------------------------- | -----------------: | -----------------: | ----------------: |
| JS before `load`                | 115.0 kB / 25.0 kB |  30.1 kB / 11.9 kB | 66.7 kB / 10.5 kB |
| Total JS after 3 widgets        | 115.0 kB / 25.0 kB |  48.7 kB / 21.5 kB | 66.7 kB / 10.5 kB |
| Client JS in dist               | 159.8 kB / 38.7 kB | 159.2 kB / 69.4 kB | 66.7 kB / 10.5 kB |
| SSR HTML                        |   33.5 kB / 6.0 kB |   33.5 kB / 6.0 kB |  27.5 kB / 5.4 kB |
| SSR renders/s                   |              4,271 |              4,105 |             5,295 |
| First click at load, 150 ms RTT |             456 ms |      229 ms (1 RT) |            106 ms |

The 456 ms is the time for 115 kB at 1.6 Mbit/s before the page can answer; 0.3.0 loads 30 kB first and the rest on demand.

### Rows (main thread from click to paint, median of 10, ms)

| Operation                         |            brumate 0.4.0 |            brumate 0.3.0 |         Marko 6 |
| --------------------------------- | -----------------------: | -----------------------: | --------------: |
| Create 1,000                      |                     34.6 |                     40.3 |            35.3 |
| Replace 1,000                     |                     31.2 |                     37.0 |            30.5 |
| Update every 10th                 |                     15.1 |                     16.2 |            14.2 |
| Select a row                      |                      2.0 |                      2.1 |             1.7 |
| Swap 2                            |                     10.9 |                      9.9 |            10.9 |
| Remove a row                      |                      9.5 |                     10.6 |             7.2 |
| Create 10,000                     |                    233.9 |                    255.6 |           239.5 |
| Append 1,000                      |                     41.5 |                     44.9 |            40.6 |
| Clear 1,000                       |                      4.9 |                      6.0 |             3.6 |
| First select, from server         |                      7.5 |                     11.2 |             5.5 |
| First update, from server         |                     32.4 |                     36.8 |            26.0 |
| First remove, from server         |                     24.7 |                     27.3 |            22.1 |
| Load + 3 s idle, main thread busy |                     57.4 |                     56.9 |            50.9 |
| JS heap, 1,000 server rows        |                   1.3 MB |                   0.9 MB |          1.1 MB |
| Client JS before load             | 80.8 kB / 28.7 kB (dist) | 73.7 kB / 27.1 kB (dist) | 9.3 kB / 4.5 kB |
| SSR renders/s, 1,000 rows         |                    1,100 |                    1,232 |             803 |

Reading:

- Size is the gap. brumate 0.4.0 ships 3.5 times the gzip bytes of Marko on todos (15.2 vs 4.4 kB) and 2.4 times on the dashboard (25.0 vs 10.5 kB). Against 0.3.0 it is +4.0 kB gzip on todos before load (+2.9 kB after the interactions, since 0.3.0 fetched code on idle and on use).
- Speed is not the gap. 0.4.0 is at or ahead of 0.3.0 on every rows click except swap, within about 10% of Marko on most, and faster than Marko in SSR on 100 todos (+38%), and 1,000 rows (+37%). Marko is faster on the small page (3 todos, -14%) and on the dashboard (-19%).
- The rows SSR for 0.4.0 looked 11% below 0.3.0 in the run (ranges did not overlap). Alone, back to back, `ssr.mjs`-style loops gave 1,182 vs 1,203 renders/s, and the CPU profiles of the two are the same shape. Treated as noise.

## Where the bytes go (todos, client)

Files loaded at start (minified, gzip -9 each): core 28.5 kB / 11.3 kB, loader (`boot` plus the Vite preload helper) 6.6 kB / 3.0 kB, the app component 1.5 kB / 0.9 kB, a 387 B re-export of the core, `events` 249 B. `rpc` (44.8 kB) and `defer` are in dist but not loaded.

Top costs inside the core (each top-level function minified alone, sum 33.5 kB before the bundler joins them; shares of that sum):

| Cost                                                                            | Min bytes | Share |
| ------------------------------------------------------------------------------- | --------: | ----: |
| `list` (keyed reconcile)                                                        |     1,976 |  5.9% |
| `addScopes` + `unpackState` + `readRecord` (resume)                             |    ~2,000 |   ~6% |
| `insertHTML` + `parseTemplate` + `clone` + `walkOf` (HTML and cloned templates) |    ~2,300 |   ~7% |
| `handle` + `trigger` + `callable` (events)                                      |    ~1,800 |   ~5% |
| ordered updates: `drain` `pass` `queue` `queueWrite` `settle` `updateReady`     |    ~2,100 |   ~6% |
| `memo` + `asyncMemo` + `get` + `prop`                                           |    ~2,000 |   ~6% |

The rest is a long flat tail: 248 top-level functions, none above 6%. The loader chunk is 57% `boot` and 19% the Vite preload helper (1.3 kB min).

The brumate pruning by feature (`children`, `templates`, `titles`, `bindings`, `lateMarkup` and more) already removes what the todos page does not use.

### What grew from 0.3.0 (core: 19.7 kB -> 28.5 kB raw, 8.2 -> 11.3 kB gzip)

Compared by function name (23.7 kB -> 33.5 kB min sum, 184 -> 248 functions). Approximate groups:

| Added in 0.4.0 work                                                                                                |   About |
| ------------------------------------------------------------------------------------------------------------------ | ------: |
| Cloned templates and the encoded walk (`parseTemplate`, `clone`, `walkOf`, from the size/speed stack #157 to #165) | +2.0 kB |
| Ordered updates (`drain`, `pass`, `queue`, `queueWrite`, `settle`, `depthOf`, `holderOf`)                          | +2.1 kB |
| `destroyRange`, `prop`, `send`, `mergeHandlers`, `loadComponent`, `setContent` and similar                         | +2.2 kB |
| Kept values on resume (`typedInto`, `readFields`, `readRecord`)                                                    | +0.8 kB |
| Streamed memo reads and promise props (`asyncMemo`, `resolve`, `unused`, `unhandled`)                              | +0.7 kB |
| Streamed `#catch` (`replaceTry`, `fail`)                                                                           | +0.2 kB |
| `list`, `addScopes`, `trigger`, `get`, `text` grew                                                                 | +1.7 kB |

No single feature explains it: the 0.4.0 work added many small correct paths. The cost per feature is small and was kept under the +0.3 kB per PR budget; together they add 3.1 kB gzip to the core.

## Where the time goes

SSR (1,000 rows, `node --cpu-prof`, 8 s): flat. `firstRender` 8.6% (flattening the 300 kB rope for the first time), `escape` 5.9%, `build` 5.8%, `stateScript` 5.3%, the `<html` regexp 4.9%, `scope` 4.3%, the serializer (`serializeProperties`, `parseProperties`, `createIndexForValue`, `parseSOS`) about 12% together, GC 2.9%. 0.3.0 has the same profile within a point.

Rows clicks in the browser (`profile-rows.mjs`): create 1,000 is 6.3 ms of script and native work in a click that takes 35 ms to paint. Native `cloneNode`, `insertBefore` and `setAttribute` are 2.5 ms of it; brumate's own code (`clone`, `setContent`, `keep`, `createScope`, `list`) is under 1.5 ms. Replace adds `Range.deleteContents` at 2.4 ms. The rest is layout and paint. The first update from a server page profiles at 13 ms of work, and `list` is 0.8 ms of it. There is no script hot spot: another 10% on rows would have to come from the browser's work, not from brumate's.

## Options

Measured with `bench.py` (SSR, 8 interleaved runs, 3 s each, load 4 to 5) and a size script that adds up the files a page loads (`hints.json` plus the entry; same files as "JS before load"). Tests: `pnpm --filter brumate test -- --maxWorkers 2 --testTimeout 30000` in each option worktree, 63 files, all pass (ssr-text: 1,287 passed and 1 skipped; try-gate: 1,288 passed).

Base for the size options: todos 37,327 B raw / 15,589 B gzip; dashboard 117,782 / 25,559; rows 36,819 / 15,348.

| Option                                                                                                                                                                                                     | Result                                                                                                      | Change                                | Cost                                                                                                                                                                                                                          | Verdict                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| A. `ssr-text`: `insertValue` returns early for strings and numbers (skips `isRaw` and `isThenable`; numbers skip `escape`)                                                                                 | rows 1,222 vs 1,185/s; dashboard 4,670 vs 4,406/s; todos(100) 10,820 vs 11,380/s                            | +3.1%, +6.0%, -4.9%, all within noise | +8 lines                                                                                                                                                                                                                      | Rejected: no measurable gain                                                |
| B. `try-gate`: read `b-catch` and `b-fail` state records only `if (HAS_LATE_MARKUP)`, so `replaceTry` and `failBoundary` leave builds with no `#loading`                                                   | todos 15,589 -> 15,480 B gzip; raw -320 B                                                                   | -109 B gzip (-0.7%)                   | one `if`, 2 lines; no behavior change since those records come only from `#loading` bodies                                                                                                                                    | Worth building if the maintainer wants every byte; small                    |
| C. `module-preload-false`: `build.modulePreload: false` in the app's Vite config (the plugin already honors it; brumate emits its own preload links)                                                       | todos 15,417 B gzip; raw -335 B                                                                             | -172 B gzip (-1.1%)                   | none in brumate; the app gives up Vite's CSS and dependency preload, which brumate's `hints.json` replaces. Vite still emits its helper                                                                                       | Cheap, app-level; mention in the docs for size-sensitive apps               |
| B + C                                                                                                                                                                                                      | todos 15,313 B; dashboard 25,338 (-221 B); rows 15,121 (-227 B)                                             | -276 B gzip (-1.8%) on todos          | both                                                                                                                                                                                                                          | Together about 0.3 kB: one budget step                                      |
| D. Remove Vite's preload helper from the loader chunk (the plugin returns no dependencies for the core already; the helper is kept for `defer` and bundle imports that brumate also lists in `hints.json`) | Simulated by editing the unminified loader chunk and minifying: 6,735 -> 5,154 B raw, 3,143 -> 2,464 B gzip | about -0.68 kB gzip (-4.4%) on todos  | Not built. It needs a plugin step on Vite's internal helper (a `renderChunk` that rewrites `__vitePreload(() => import(x), deps)` to `import(x)`), which depends on Vite internals and breaks the CSS preload of lazy bundles | Best gain here; needs a spike to see if Vite gives a switch. Candidate node |

Patches (diffs against `3bba0c09`) are in `/private/tmp/claude-501/-Users-alexis-Documents-GitHub-brumate/b4a68a19-1f3f-4143-b0e4-803a3790a6b2/scratchpad/perf-options/`:

- `ssr-text.patch`
- `try-gate.patch`
- `module-preload-false.patch`
- `try-gate+module-preload-false.patch`

(D has no patch; the numbers come from the simulation above.) The option worktrees are removed.

### Ideas looked at and dropped without a build

- Scanning for `<html` in `firstRender` (4.9% of SSR): the regexp already scans at about 7 GB/s; an exact case-insensitive check cannot be cheaper without allocating, and a case-sensitive check changes behavior for `<HTML>`.
- Joining the 387 B core re-export chunk and the 249 B `events` chunk: saves under 0.2 kB gzip and one request each; the chunks come from the bundler's splitting.
- Script work in rows clicks: under 1.5 ms of 35 ms; nothing to gain.
- Gating `asyncMemo` and the ordered-update code behind a feature flag: a memo can return a promise from any call, and update order is needed whenever two components share a prop, so the compiler cannot prove the code unused.

## What the numbers say

The gap to Marko is bytes, and it is a long tail, not one thing. Options B and C together give 0.3 kB, D about 0.7 kB: 1 kB of 15.2 kB (7%) at best. Getting near Marko's 4.4 kB would need a smaller core by design (fewer paths in the always-loaded part), which is a change of the architecture, not a pass. The dashboard cold click (456 ms against 106 ms) is the price of loading the whole page's code at start, and it is a choice already made.

## Gate

The maintainer picks which options to build. Each chosen option becomes its own PR (or a node), not part of this report PR. Suggested order if any: C (docs only), B (one line), D (spike).
