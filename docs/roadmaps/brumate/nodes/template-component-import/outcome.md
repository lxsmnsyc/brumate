# Outcome: template-component-import

## Built

- packages/brumate/src/codegen/client.ts: `partScopes(part)`; `assemble` and `assembleAll` import the components, imports and nested templates of every template that a site of the part copies.
- packages/brumate/test/resume.test.ts, test/render/tplImportHost.brm, TplImportList.brm, TplImportItem.brm: a list in a browser-rendered component calls a same-file template that renders a component; a pick updates it (fails on main with the ReferenceError).
- Cleanup test, six old rows clean up once each on a pick. `it.fails` until #472 merges; passes with #472's source.
- .changeset/template-component-import.md (patch).

## Deviations

- The brief's cleanup test expects "each replaced row". A pick replaces all six rows, not only the two whose flag changed, so the test expects six cleanups.

## Stubs left

- Change the cleanup test from `it.fails` to `it` once #472 merges.

## Gotchas

- An `$effect` of a component created in the browser does not run on creation, only on a change. The test clicks each item to start it. Not changed here.

## Proposed learnings

- None.

## Verification

- New update test fails on main (ReferenceError), passes with the fix. packages/brumate (2804 passed, 1 expected fail), tsc, language-server (after building language-core, typescript-plugin, tsc), vscode, hackernews, kit-app, nitro, todos, tracker, ui-kit: exit 0. Typecheck, oxlint, oxfmt: exit 0.
- packages/ui exits 1: a few timing tests fail and differ between runs; token-field-sync fails the same on main's client.ts (4 failures there, 2 with the change).

## Size

- Estimated S, actual S.
- Client gzip (sum of dist/client/**/*.js, gzip -9): todos 39,236 to 39,238 B (+2), ui 199,042 to 199,063 B (+21), on clean rebuilds of both refs. ui grows because parts that call templates now import what the templates use.
