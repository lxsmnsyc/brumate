# Outcome: nested-template-imports

## Built

- `inside()` in packages/brumate/src/codegen/client.ts adds a template scope unless the list already has it (`!result.includes(template)`). Before, it skipped a template that sits within a scope of the list, so a template declared in a block body was never added and `componentNames` never read its markup.
- `declared()` in the same file filters a scope list for emission: a template that sits within an earlier scope of the list is emitted where its `#template` is. `emitRender`, the children render and the template wrapper use it, so each template is emitted once. `inside()` keeps the full list for imports and reads. Without `declared()`, the one-line change emitted `function item` twice.
- Fixtures in packages/brumate/test/render: templateNested.brm (core-gaps.md section 3), templateNestedDeep.brm (two blocks deep), templateNestedTwice.brm (a template in a template, called twice) and templateNestedLoop.brm (a template in an `#if` in a `#for`, reading the loop value).
- Four tests in packages/brumate/test/resume.test.ts, in `describe('templates inside blocks')`. Each asserts the names of the functions that the render functions declare, so a duplicate fails. All names contain "template that sits inside a block".
- Changeset .changeset/nested-template-imports.md, a patch for brumate.

## Deviations

- Added `declared()`, three fixtures and three tests that the brief did not list. They are in the owned codegen file and the owned test/render folder.

## Stubs left

- None.

## Gotchas

- `inside()` is the list for imports and reads. It is not the list for emission. Emit through `declared()`, or a nested template is defined twice, with the first copy before its scope const.
- Keep the four tests when `inside()` changes.

## Proposed learnings

- A scope list that is built by following calls is checked with `includes`, and a list that code is emitted from is filtered for the templates that sit within a scope of the list | the ancestor test hides templates for imports, and no test for it duplicates them in the output | packages/brumate/src/codegen | yes

## Verification

- The tests fail on main (`TplDynamic is not defined`) and pass with the fix. With `declared()` made a no-op, all four fail on the duplicate.
- `npx vitest run` in packages/brumate: 55 files, 944 passed, 5 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0.
- `npx oxlint --quiet` and `npx oxfmt --check` from the root: exit 0.

## Size

- Gzip of the eager core with `npx tsdown`: `client-*.js` 30748 B, `produce-*.js` 3863 B, unchanged. The budget is 0.1 kB.
- Generated update code of templateNested.brm: 1022 B on main (the imports are missing), 1412 B with only the one-line change (two `function item`), 1075 B with `declared()`.
- Estimated S, actual S.
