# Outcome: store-repair-compare

## Built

- `storeUpdate` (runtime/client/context.ts) sends nothing when the new value is another object with the same data as the store's value. A store of an object memo, in a component that the browser renders, no longer rewrites its readers at creation, and the item scopes of their lists are not created twice.
- `sameData` (runtime/store.ts) stops at a depth of 32, so a cycle ends and counts as changed.
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

- gzip -9 of each `.js` in dist, summed, before -> after: examples/ui 202,902 -> 202,939 B (+37); examples/todos 39,495 -> 39,516 B (+21).
- `sameData` on 10,000 equal rows of three fields: 2.6 ms, once per resumed read. It runs only when `Object.is` fails, so a shared or primitive value costs nothing. Not reduced further.

## Gotchas

- The memo of a browser-rendered provider computes a new object at creation, and the `provide` update forces `sendStore` (needed for `$toStore(signal)`, where `set` writes before the update). The skip is in `storeUpdate`, and only for another object with the same data. A skip in the reader's listener broke ui token-field tests, since a write of equal data repaints a DOM that the user changed. A skip in `sendStore` would drop the update after a `set`.

## Tests

- brumate: 10 failed in the full run under load, 0 when the 4 files reran alone with --maxWorkers=3 (771 passed). Other packages and examples pass; language-server and tsc needed `language-core`, `tsc` and `typescript-plugin` built first.
- ui: failures differ in each run (5 to 42), all happy-dom or timing; token-field, token-field-sync and validation failed 4 to 6 on the base too.

## Follow-ups

- A browser-rendered component that calls a `#template` of its own file renders it again at each evaluation, and the old template scopes stay in `scopes` (7 to 9 after one pick, with primitives too). `write` in runtime/client/inserts.ts updates in place only a `TemplateCall`. Not a store matter; needs its own node.
- One run of the ui e2e showed 1 failed of 10 before the rest was skipped; the next run passed 55/55 (machine under load).
