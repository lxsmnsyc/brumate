# Performance notes

Ideas measured or found during the 2026-10-21 performance work that are not done yet. Each item says where the cost is, the change, and the gain that was measured or estimated. `pnpm bench` in [`benchmarks/`](../benchmarks) is the way to check a change.

## Baseline on main, 2026-10-27

This is the baseline that each step of the smaller client reports against. It is a run of `pnpm bench` on main at commit `f45a5c74`, on 2026-10-27. The code is the same as at `654f05dd`; only docs came after it. The machine was an Apple M2 with 8 cores and Node 26.12.1. Sizes are raw / gzip -9.

### Size

Sizes do not depend on load. They were the same in all three runs (the 3-todo HTML differed by 2 B).

| Scenario  | Metric                                  | Files |                             Size |
| --------- | --------------------------------------- | ----: | -------------------------------: |
| Todos     | JS before `load`                        |     5 |            32.8 kB / **13.9 kB** |
| Todos     | JS on the first click (counter, toggle) |     0 |                              0 B |
| Todos     | Total JS after counter, toggle and add  |     5 |                32.8 kB / 13.9 kB |
| Todos     | Client JS emitted in dist               |     7 |                77.2 kB / 27.5 kB |
| Todos     | SSR HTML, 3 todos / 100 todos           |       | 1.5 kB / 711 B, 16.2 kB / 2.1 kB |
| Todos     | Per extra todo                          |       |                     155 B / 15 B |
| Rows      | Client JS emitted in dist               |     6 |            76.7 kB / **27.3 kB** |
| Rows      | SSR HTML, 1,000 rows                    |       |               307.2 kB / 24.2 kB |
| Dashboard | JS before `load`                        |     4 |               111.4 kB / 23.6 kB |
| Dashboard | JS on the first click and on scroll     |     0 |                              0 B |
| Dashboard | Client JS emitted in dist               |     6 |               155.8 kB / 37.3 kB |

The rows report has no `JS before load` row. The page loads all of its client code when it starts, so the 27.3 kB of the build output is the ceiling for what loads. The first click of the todos and dashboard pages fetches nothing, since the page loads its code at the start (see "Client loading").

The benchmarks README, from 2026-10-22, has 2.1 kB gzip before `load` for todos and 3.1 kB for the dashboard. Now they are 13.9 kB and 23.6 kB. The likely cause is the change of 2026-10-25 that loads all page code at the start (not checked here). These are the numbers that the next steps have to bring down. Marko 6 loads 4.4 kB and 10.5 kB.

### Size after size-trim, 2026-10-27

Todos, JS before `load`, gzip bytes from `benchmarks/results/*.json` (`browser.boot.jsGzip`), built in one worktree for each row. The 13.9 kB of the baseline is KiB: 14,227 B when rebuilt at `f45a5c74`.

| Build                                                  | Raw (B) | Gzip (B) | Against the baseline |
| ------------------------------------------------------ | ------: | -------: | -------------------: |
| Baseline, `f45a5c74` rebuilt                           |  33,607 |   14,227 |                    0 |
| Main before size-trim (`eb30de16`, with #295 and #296) |  35,132 |   14,823 |                 +596 |
| After size-trim                                        |  35,009 |   14,768 |                 +541 |

Only the large `client` chunk moved (25,150 B raw at the baseline). The goal of 0.1 kB is not met. What the rest buys, from removing each feature in turn:

- `readFields` and `typedInto` (fields typed before the code loads): 254 B.
- `settle`, the read of a memo that waits in a pass (batching): about 50 B.
- The merged handlers (`mergeHandlers` in `callable` and `addEntryHandlers`): about 45 B. They were already in the baseline.
- Held memo errors in `get`: 8 B. `updateReady`: 11 B.
- The rest, about 190 B, is spread over the pass and the effect run, `hold`, `forwardRef` and `restRef`, the live props of a dynamic tag and `call` inside a pass, with no single piece over 30 B.

Rows probe (`#for` of N rows, each a component with `$memo(item + count)`, `count++`, happy-dom, 6 clicks, 3 runs each, ms per click after the first): 1,000 rows 5 to 6 on both; 4,000 rows 10 to 14 on both; 10,000 rows 31 to 52 on main, 31 to 39 after. No write is slower.

### Speed

The timings were taken under load: other agents ran tests and builds on the machine during every run. The load average was 6.5 to 8.9 on 8 cores at the start and end of each run. The min to max ranges are wide. Compare them only with runs on the same machine, ideally with an idle one. The ratios to Marko 6 inside one run are the safest thing to compare.

Three runs of `pnpm bench --scenario todos,dashboard`, then one run of `--scenario rows` (about 20 minutes with 10 runs, so it ran once). The tables give the median of the three runs, then each run.

| Metric (brumate)                                      | Median |   Run 1 |  Run 2 |  Run 3 |
| ----------------------------------------------------- | -----: | ------: | -----: | -----: |
| Load average at start of the run                      |        |    8.76 |   8.86 |   6.50 |
| SSR renders/s, 3 todos                                | 52,606 | 121,476 | 52,606 | 47,504 |
| SSR renders/s, 100 todos                              |  6,246 |  11,714 |  6,246 |  4,441 |
| SSR renders/s, dashboard page                         |  2,086 |   4,804 |  2,086 |  1,922 |
| Todos click to update: counter, ms                    |    318 |     117 |    318 |    348 |
| Todos click to update: toggle, ms                     |     77 |      47 |    137 |     77 |
| Todos click to update: add, ms                        |    151 |     115 |    151 |    172 |
| Todos first counter click, 150 ms RTT, after idle, ms |     97 |      97 |    100 |     73 |
| Todos first counter click, 150 ms RTT, cold, ms       |    116 |     117 |    116 |     94 |
| Dashboard click to update: widget 1, ms               |    122 |     294 |     46 |    122 |
| Dashboard click to update: widget 30, ms              |     22 |     183 |     19 |     22 |
| Dashboard click to update: widget 45, ms              |     21 |     237 |     19 |     21 |
| Dashboard first click, 150 ms RTT, after idle, ms     |    129 |     421 |    103 |    129 |
| Dashboard first click, 150 ms RTT, cold, ms           |    442 |     431 |    445 |    442 |

Run 1 had the highest SSR rates. Runs 2 and 3 had up to 2.6 times fewer renders per second, and the click timings moved by up to 6 times. The load explains this. In run 1, brumate rendered 3 todos at 121,476 per second against 134,625 for Marko 6, and 100 todos at 11,714 against 8,449.

The rows scenario ran once, with a load average of 8.14 at the start and 3.69 at the end. The table gives the main thread time from the click to the paint in ms, as the median of 10 with the min to max:

| Operation                                                 | brumate                | Marko 6                 |
| --------------------------------------------------------- | ---------------------- | ----------------------- |
| Create 1,000 rows                                         | 52.4 (37.7 to 62.5)    | 33.1 (22.9 to 48.6)     |
| Replace 1,000 rows                                        | 62 (47.1 to 83.4)      | 28.6 (24.6 to 41.2)     |
| Update every 10th of 1,000 rows                           | 25.9 (18.4 to 33.1)    | 11.2 (8.7 to 13.7)      |
| Select a row of 1,000                                     | 2.5 (1.9 to 5.4)       | 1.1 (0.8 to 1.3)        |
| Swap 2 of 1,000 rows                                      | 6.9 (5.5 to 9)         | 5.6 (4.1 to 9.7)        |
| Remove a row of 1,000                                     | 11 (6.9 to 13.7)       | 12.1 (10.7 to 12.9)     |
| Create 10,000 rows                                        | 270.6 (243.2 to 358.4) | 502.4 (353.7 to 1329.8) |
| Append 1,000 rows to 1,000                                | 68.6 (41 to 75.5)      | 63.5 (46.1 to 79.5)     |
| Clear 1,000 rows                                          | 5.9 (4.9 to 9.3)       | 4.5 (3.2 to 5.7)        |
| First select on 1,000 server rows, main thread / to paint | 8.8 / 14.1             | 5.1 / 13.9              |
| SSR renders/s, 1,000 rows                                 | 244                    | 249                     |

The full tables of every run are in `benchmarks/results/`, which git ignores.

## Where brumate stands

The numbers below are from earlier runs. The baseline above replaces them as the reference.

On the todos scenario, at commit `3e95739`:

- HTML per extra todo is 165 B raw and 20 B gzip. Marko 6 is 153 B and 23 B.
- The 100-todo page is 2.5 kB gzip. Marko 6 is 2.8 kB.
- JS before `load` is 2.1 kB gzip. A click after idle needs no requests.
- SSR is about 2× slower than Marko 6. Serializing the state is 60% of the render time at 3 todos and 75% at 100.

On the dashboard scenario, brumate loads the least before `load` (3.1 kB gzip against 10.5 kB for Marko 6). After three widgets it has loaded 23.5 kB gzip in 46 files, against 10.5 kB in one file for Marko 6.

## SSR

The prototypes for these are in a scratch profile run. Gains are renders per CPU second with the output string flattened, at 3 and 100 todos, and each one adds to the ones before it.

1. A one-pass serializer for the state of a page with nothing pending. It walks the packed state once and writes the code with `s +=`. It inserts `$R[i]=` only before objects that appear twice. Anything else, such as a promise, Map, Set, Date, class instance or cycle, falls back to seroval. Measured +25% and +47%.
   - A two-pass scan and write, and a version that joins an array, were both slower than seroval.
   - It has to match seroval for `-0`, `NaN`, bigint, symbol keys and escaping.
2. Render to a string, or to a lighter stream than `ReadableStream`, for pages with nothing pending. Node's web streams cost about 3 µs per page. Measured +26% and +13% after the other items. This is an API change.
3. Smaller scope bookkeeping. Build `root.tree` lazily from the records, since only `provide` and `consume` read it. Keep slot names in a static table per component, read only for errors. Have the compiler write list items straight into packed groups, because `packState` is still 9% to 11% after the other items.

## seroval

### Upgrade

Done in brumate with seroval 1.7.0, which has [seroval#249](https://github.com/lxsmnsyc/seroval/pull/249). Every plugin in `src/runtime/serial.ts` sets `skipPlainObjects`, and raw HTML is a class instance, so seroval tests no plugin on a plain object.

`assignSharedRefsOnly` works only with `crossSerialize`, not `crossSerializeStream`. Done in brumate for a page with no pending `#loading` body: its state is serialized with `crossSerialize` and `assignSharedRefsOnly`, because no later record refers back. A state with a promise makes `crossSerialize` throw, and then it streams as before. On the benchmark it gave:

- Todos: 3 todos went from about 102k to 121k renders per second, and 100 todos from about 9.7k to 11.0k. The 100-todo page went from 2.3 kB to 2.0 kB gzip, and each extra todo from 18 B to 15 B gzip.
- Dashboard: the page went from 6.7 kB to 6.1 kB gzip. Renders per second stayed about the same.

### Ideas

These would speed up every seroval user, not only brumate. They are ordered from the smallest change to the largest. Items 1 to 6 are done in seroval 1.7.0, except the cache of property keys in item 2, which made objects with many unique keys slower.

1. Check short strings with one regex before the loop over characters. `serializeString` only does this for strings of 64 characters or more, and most keys and values are shorter.
2. Cache the serialized form of property keys. `serializeProperty` runs `Number(key)`, `toString()` and the identifier regex for every key of every object, and keys repeat.
3. Resolve the plugin list once. `crossSerializeStream` calls `resolvePlugins` on each call, which builds a new `Set` and array. A `WeakMap` keyed by the plugins array removes this.
4. Let a plugin say what it can match, such as functions or one class. Then plain objects and arrays skip the plugin tests that `parseObject` runs before the built-in types.
5. Allocate less while parsing. `parseProperties` builds `Object.entries` for each object, and each primitive gets a node with 12 fields. Shared nodes for small numbers and the empty string, and lighter primitive nodes, would cut allocation. brumate allocates about twice what Marko 6 does per render.
6. An option for cross mode to assign only the references that are shared. Cross mode writes `$R[n]=` before every object, in case a later record refers to it. A caller that knows no later record will, such as a page with nothing pending, would get smaller and faster output.
7. Serialize in one pass for code output. Parsing builds a node tree and serializing walks it again. A single walk that writes code as it goes, and inserts reference assignments when an object appears again, would remove the tree. Promises, streams, async iterables, async plugins and cycles would keep the current path. The brumate-only prototype in the SSR list measured +25% and +47%.

brumate can also help on its side. `isRaw` matches on a symbol key, so every plain object runs that plugin test. A class for raw values would let the test check the class.

## Benchmarks

- The SSR loop never flattens or encodes the HTML, so it favors the renderer that flattens less. Flattening each render changed Marko 6 from about 10.4k to 8.0k renders per second at 100 todos, and brumate from 6.8k to 6.5k. The harness should run `Buffer.byteLength(html)` per render.
- The dashboard widgets are generated and share many lines, so one eager bundle compresses better than real code would. More varied widgets would make the comparison fairer.

## Client loading

- Done: the plugin's `merge` default is 4096 B. Each dashboard widget is now one module. Total JS after 3 widgets went from 46 files and 23.5 kB gzip to 13 files and 16.9 kB, and the idle preload from 21 files and 11.6 kB to 6 files and 8.6 kB.
- Done on 2026-10-25: the page loads its code when it starts, in one bundle per root component, and `handleRoute` pages get modulepreload links for the bundles. The idle preload and `prefetch` are removed. A click after the bundles have loaded needs no request.
- The loader is 2.1 kB gzip. Vite's preload helper is about 0.8 kB of that, because Vite 8 wraps every dynamic import in it. Replacing the helper for the whole app would break CSS preloading in user code.

## Client updates

Notes from the 2026-10-24 work on the `rows` scenario, which times the work of the browser after a click. See [`benchmarks/README.md`](../benchmarks/README.md).

### Where brumate stands

Against Marko 6 on an Apple M2, as the main thread time from the click to the paint:

- Creating 1,000 rows takes 1.19 times as long, 10,000 rows 1.08 times, and replacing 1,000 rows 1.23 times.
- Swap, remove and append are as fast as Marko 6 or faster. Select, update and clear are about equal.
- The first select on a page of 1,000 rows from the server paints at the same time as Marko 6.

### What the costs were

The first guess was Array methods and short-lived functions. They were a small part. These were the large ones, all fixed in #73 and #74:

- Each update of a new row searched the page for its element with `document.querySelector`, so creating rows took time that grew with the square of the list. 10,000 rows took 4.2 s.
- Once one item of a list moved, every item after it moved too. A longest increasing subsequence now picks the items that stay.
- An insert took the scopes that the client had just rendered for scopes from the server, and ran all of their updates again.
- The loader's MutationObserver scanned each row again after the core had scanned the insert.
- The first click imported again the modules that the loader had preloaded. In Chrome, an `import()` of a module that is loaded already still resolves in a task of its own, which can run after the next frame.

### What is left on create

Creating 1,000 rows costs about 5 ms more than Marko 6, of about 28 ms. Layout and paint cost the same. The rest:

- Parsing the HTML string costs about 1 ms more than cloning a template would.
- The loader's scan for event delegation costs about 1 ms.
- Making the scopes and the HTML string of the rows costs about 1.5 ms.
- Garbage collection, and parsing the `b-b` and `b-on` attributes of each row, cost the rest.

### Templates

Rendering with `<template>` and `cloneNode`, as Marko 6 and Solid do, was measured and not done:

- `innerHTML` of 1,000 rows takes 3.0 ms. Cloning a row template 1,000 times and filling it takes 2.1 ms. Layout takes about 10 ms either way.
- With references to the elements kept from the clone, new rows would need no `b-b` and no index. The estimate is 2 to 3 ms less for each 1,000 rows, which brings create to within 5 to 10% of Marko 6.
- It needs a second output of the client in `codegen/markup.ts`, which writes one string format for the server and the client now. Components, `children`, `raw()`, spreads, SVG, `#await`, `#loading`, `#reveal`, `<title>` and scoped CSS each need their own path or a fallback to strings, and the two outputs can disagree.

Only bulk creation gains, and apps rarely create 1,000 rows in one click. Do it only if an app shows bulk creation as its bottleneck.

A smaller idea: make the `children` set of a scope only when it gets a child, so each row allocates less.

### Measuring

- The report shows the main thread time, not the time to the paint. A paint waits for the next frame, so the time to the paint moves in steps of about 16 ms.
- The span ends at the last `Paint` event. The frames that the harness waits for commit with nothing to paint, and ending at a `Commit` added a frame to some runs.
- Every rows app has the same small stylesheet. Without one, selecting a row paints nothing.
- For readable profiles, build with `npx vite build rows --outDir dist/client --minify false` in `benchmarks/brumate`, and run `pnpm run build:rows` after.
- A CDP `Profiler` sample of 20 to 50 µs shows the time of each function. A Chrome trace with the `devtools.timeline` categories splits a click into script, `ParseHTML`, `Layout` and garbage collection.
- To find a wait, record `performance.now()` in a `pointerdown` listener on `window` in the capture phase, and in a MutationObserver on the list. A `click` listener on `document` runs after Marko's handler.
- The functions of Playwright, such as `_matchesCSS` and `query`, show up in profiles. They are not brumate's.
- Other work on the machine changes the timings a lot. Compare the ratios to Marko 6 within one run.
