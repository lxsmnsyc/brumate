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
2. Do not send the item slot when the `#for` source is a parent slot or memo. The client sets `s[0]` and `i` from the parent's list by index. Measured +11% and +23% on top of item 1, and the state for 100 todos drops from 17.4 kB to 15.9 kB.
   - This is safe because the item cannot change on its own. The analyzer rejects any write to a loop variable with `Cannot assign to item`, in handlers and in block scripts. A change in place, such as `todo.done = true`, is a warning, and it changes the same object that the parent's list holds.
   - Slots of a block script in the body still ship, so only the item slot goes.
   - Computed sources such as `todos.filter(...)` keep the current path, because the client would have to run the expression again.
   - This changes the page format.
3. Render to a string, or to a lighter stream than `ReadableStream`, for pages with nothing pending. Node's web streams cost about 3 µs per page. Measured +26% and +13% after the other items. This is an API change.
4. Smaller scope bookkeeping. Build `root.tree` lazily from the records, since only `provide` and `consume` read it. Keep slot names in a static table per component, read only for errors. Have the compiler write list items straight into packed groups, because `packState` is still 9% to 11% after the other items.

## seroval

### Upgrade

[seroval#249](https://github.com/lxsmnsyc/seroval/pull/249) speeds up cross serialization with plugins. seroval's `main` is also 17% to 22% faster than the 1.6.11 that brumate uses, from changes that are not released yet. On a todos-shaped benchmark, a release with both would be 31% to 34% faster than 1.6.11. When it is out:

1. Bump `seroval` and `seroval-plugins` in `packages/brumate`.
2. Set `skipPlainObjects: true` on every plugin in `src/runtime/serial.ts` that never matches a plain object. That is 6 of the 7 today.
3. Make raw values instances of a class, and test them with `instanceof`, so `RawPlugin` can skip plain objects too. Today it matches on a symbol key, so it must test every plain object.
4. Run `pnpm bench --only brumate` and update the numbers in this file.

`assignSharedRefsOnly` from the same PR works only with `crossSerialize`, not `crossSerializeStream`. brumate could use it for a page with nothing pending, where no later record refers back. That record would be about 21% smaller.

### Ideas

These would speed up every seroval user, not only brumate. They are ordered from the smallest change to the largest. Items 1, 2 and 5 are mostly done on seroval's `main`, and items 3, 4 and 6 are in the PR above.

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

- Merge the parts of a component when the total is small, counted per component. The dashboard widgets ship as 4 parts each, because the default `merge` of 2048 B is too low for them, and each small file compresses badly on its own.
- Preload only the handler parts at idle, and load render and update parts when a handler needs them. The idle preload on the dashboard fetches 12 files per scroll for widgets nobody clicks.
- Components too big to merge still take two round trips: the entry, then the part. Putting part URLs in the loader's registry would fix this, but it grows the loader with each part.
- The loader is 2.1 kB gzip. Vite's preload helper is about 0.8 kB of that, because Vite 8 wraps every dynamic import in it. Replacing the helper for the whole app would break CSS preloading in user code.

## Tooling

- Vitest 5 caches transformed modules in `node_modules/.vitest-cache`, and the cache is not cleared when the built `brumate` package changes. The examples then run old output until `pnpm vitest --clearCache`. The Vite plugin could add a cache key.
- The breaking changes in `e8a92a1`, `434c536` and `32761f6` have no changeset yet.
