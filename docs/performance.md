# Performance notes

Ideas measured or found during the 2026-10-21 performance work that are not done yet. Each item says where the cost is, the change, and the gain that was measured or estimated. `pnpm bench` in [`benchmarks/`](../benchmarks) is the way to check a change.

## Where brumate stands

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
- The idle preload loads the entry, the handler parts and `update`, and the core reuses those loads on the first click. `$client` parts wait for their trigger.
- Components too big to merge still take two round trips on a cold first event: the entry, then the part. Merged components take one, so the cold dashboard click is now 1 RT. Putting part URLs in the loader's registry would fix the rest, but it grows the loader with each part.
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
