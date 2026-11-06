# Outcome: template-scope-leak

## Built

- packages/brumate/src/runtime/client/scopes.ts: `destroyNodes(scope, first, end)`, exported; `destroyRange` calls it.
- packages/brumate/src/runtime/client/inserts.ts: `write()` destroys the scopes of the nodes it removes, so their cleanups run. Gated on `HAS_CHILDREN || HAS_TEMPLATES`: ungated, the core of a counter grew and the `windows` test of test/features.test.ts (code length against the flag) failed.
- packages/brumate/test/resume.test.ts and test/render/scopeLeak.brm, ScopeLeakList.brm: scope count stays flat across four updates (fails on main: 5 distinct counts).
- .changeset/template-scope-leak.md (patch).

## Deviations

- The brief's suspected cause was wrong. A same-file template is not a `TemplateCall`; it is a function returning `raw(html, scope)`. The in-place path is for templates of other components and was not touched. The fix is only the destroy on the rerender path.

## Stubs left

- None.

## Gotchas

- A same-file template still re-renders its markup at each update (new nodes, new scope); only the old scope goes now. Updating it in place would keep focus and elements, and is a separate change.

## Proposed learnings

- None.

## Verification

- New test fails on main, passes with the fix. packages/brumate resume, features, inspect: pass. Typecheck, oxlint, oxfmt: exit 0. Failing on main too, same files: packages/tsc (2), packages/language-server (suite does not load), packages/ui (timing and load, different tests fail between runs).

## Size

- Estimated S, actual S.
- Client gzip (sum of dist/client/**/*.js, gzip -9): todos 39256 to 39237 bytes, ui 199058 to 199046 bytes.
