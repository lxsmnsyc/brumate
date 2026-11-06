# Log: store-repair-compare

- 2026-11-06: start on feat/store-repair-compare (fed4e3b1). Part 1 (`sameData` in the resume repair) was done by context-read-fallback.
- Provided object stores (`store({ ... })` in a provider, `$toStore` of an object memo): the server-rendered page does not rewrite its readers on resume. The test passes on `Object.is` too, since the server's value is the browser's first value. It stays as a guard.
- The `spikeTemplate` shape, restored as `ViewSelect`/`ViewList` (an object memo `{ open, value }` into `$toStore`, a `#for` list with a `#template` prop): the server-rendered page resumes with one write per pick and 7 scopes. The browser-rendered page (`#if` shows the select) wrote the reader once at creation, `view null`, and its template scopes were doubled (9 instead of 7).
- Cause: the memo makes its object again at creation, the update of the `provide` site forces `sendStore`, and the reader slot got a new object that `Object.is` called a change. `storeUpdate` now skips a value that is `sameData` as the store's value but is another object. A `set` of the store wrote the same object before the update, so it still goes out.
- First try: the same skip in the `subscribeSlot` listener. It broke ui token-field and validation tests, where a write of equal data repaints a DOM that the user changed. Dropped.
- `sameData` got a depth limit of 32, which ends a cycle. The compare runs only when `Object.is` fails. Measured: 10,000 equal rows of three fields compare in 2.6 ms, once per resumed read.
- Skip link: `node e2e/run.mjs --only ui --no-build` passes 55/55 on the build of this branch, and the suite now asserts `visually-hidden focusable` on `a.skip` at load. The classes do not drop, so there was nothing to trace. One earlier run showed 1 failed after 9 passed (the name was not read); the next run passed 55/55 and I did not hunt it.
- Found, not fixed: a template of the same file that a browser-rendered component calls is rendered again at each evaluation of its call, and the scopes of the earlier render stay in `scopes` (7 to 9 after a pick, also with two stores of primitives). The in-place update in `write` (`inserts.ts`) only handles a `TemplateCall`, which the server's references make.

## Review fixes

- Fresh review: no blocker. `sameData`'s depth limit cost about k^32 calls for two cyclic objects with k keys. Replaced by the set of pairs under compare.
- The review's revert check showed the provided-object test and the server-render test pass without the fix; only the browser-render test proves it.
- Running the failing ui files alone against fed4e3b1 showed token-field (3) and validation (1) failing only with 92c8d42d: the skip dropped later updates of equal data that undo a reader's edit. Limited the skip to the first update after the store is made (`Store.f`). A microtask limit was tried and is too short: the memo's second run comes after the code loads.
- ui e2e 55/55 after the fixes.
