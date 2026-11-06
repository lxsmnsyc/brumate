# Outcome: store-repair-compare

## Built

- `storeUpdate` (runtime/client/context.ts) sends nothing when its first update after the store is made (`Store.f`) is another object with the same data as the store's value. Later updates always go out. A store of an object memo, in a component that the browser renders, no longer rewrites its readers at creation, and the item scopes of their lists are not created twice.
- `sameData` (runtime/store.ts) keeps the pairs under compare, so a cycle counts as the same and each pair is compared once. The depth limit of 32 (an exponential cost for a cycle with several keys) is gone. Tests in test/same-data.test.ts.
- Tests in packages/brumate/test/stores/stores.test.ts, fixtures in test/stores/render:
  - "a provided store of an object": a provider's `store({ ... })` and a `$toStore` of an object memo do not rewrite their readers on resume, and a change still reaches them. The `savedTheme` test already covers a browser value that differs.
  - "an object memo that feeds $toStore": the `spikeTemplate` shape (`ViewSelect`, `ViewList`, `viewServer`, `viewBrowser`). Server and browser render: no write at creation, one write for a pick, 7 scopes. The browser test fails without the fix (`view null` ran, 9 scopes).
- e2e/suites/ui.mjs asserts `visually-hidden focusable` on the skip link at load.
- `.changeset/store-repair-compare.md` (brumate, patch).

## Result of the three open points

- Provided object stores on resume: no rewrite, nothing to fix there.
- Object memo into `$toStore`, browser-rendered: reproduced (the bug static-contexts-final saw) and fixed.
- Skip link: classes stay; `node e2e/run.mjs --only ui --no-build` 55/55.

## Measured

- gzip -9 of each client `.js`, summed, before -> after review fixes: examples/ui 202,902 -> 202,959 B (+57); examples/todos 39,495 -> 39,493 B (-2).
- `sameData` on 10,000 equal rows of three fields: 2.6 ms, once per resumed read. It runs only when `Object.is` fails, so a shared or primitive value costs nothing. Not reduced further.

## Gotchas

- The memo of a browser-rendered provider computes a new object at creation, and the `provide` update forces `sendStore` (needed for `$toStore(signal)`, where `set` writes before the update). The skip is in `storeUpdate`, and only for another object with the same data. A skip in the reader's listener broke ui token-field tests, since a write of equal data repaints a DOM that the user changed. A skip in `sendStore` would drop the update after a `set`.

## Tests

- brumate: 10 failed in the full run under load, 0 when the 4 files reran alone with --maxWorkers=3 (771 passed). Other packages and examples pass; language-server and tsc needed `language-core`, `tsc` and `typescript-plugin` built first.
- ui: failures differ in each run under load. The first version of the fix (skip on every update) broke token-field (3 tests) and validation (1) for real: they pass on the base when run alone. A later update of equal data must still go out, since a reader can hold an edit (a refused edit, a server error after the user typed) that it undoes. The review fix limits the skip to the first update; each file then passes alone, twice. token-field-sync and as-collections fail only with other files running.

## Follow-ups

- A browser-rendered component that calls a `#template` of its own file renders it again at each evaluation, and the old template scopes stay in `scopes` (7 to 9 after one pick, with primitives too). `write` in runtime/client/inserts.ts updates in place only a `TemplateCall`. Not a store matter. The review found the same on origin/main ([0, 6, 8, 10, ...] scopes, two per pick, never freed): filed as a 0.6.1 node from main.
- One run of the ui e2e showed 1 failed of 10 before the rest was skipped; the next run passed 55/55 (machine under load).
- The first update after creation is still skipped when its data equals the store's value. A reader edit before that first update, undone by equal data, would be dropped; no test or part does that.
