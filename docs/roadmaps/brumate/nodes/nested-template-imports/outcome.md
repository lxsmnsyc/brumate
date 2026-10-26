# Outcome: nested-template-imports

## Built

- `inside()` in packages/brumate/src/codegen/client.ts adds a template scope unless the list already has it (`!result.includes(template)`). Before, it skipped a template that sits within a scope of the list, so a template declared in a block body was never added and `componentNames` never read its markup.
- Fixtures packages/brumate/test/render/templateNested.brm (the one of core-gaps.md section 3) and templateNestedDeep.brm (a template two blocks deep).
- Two tests in packages/brumate/test/resume.test.ts, in `describe('templates inside blocks')`.
- Changeset .changeset/nested-template-imports.md, a patch for brumate.

## Deviations

- Added the two-blocks-deep fixture and test, which the brief did not list. Its path is under the owned test/render folder.

## Stubs left

- None.

## Gotchas

- `inside()` feeds `importsFor`, `prologue` and the template definitions of render modules. The whole suite passes with the change, so those users accept the extra templates, but a later change to `inside()` should keep both tests.

## Proposed learnings

- A scope list that is built by following calls is checked with `includes`, not with an ancestor test | the ancestor test hides templates that are declared inside the body that calls them | packages/brumate/src/codegen | yes

## Verification

- Both new tests fail on main (`TplDynamic is not defined`) and pass with the fix.
- `npx vitest run` in packages/brumate: 55 files, 942 passed, 5 expected fail.
- `npx tsc --noEmit -p .` in packages/brumate: exit 0.
- `npx oxlint --quiet` and `npx oxfmt --check` from the root: exit 0.

## Size

Gzip of the eager core with `npx tsdown`, before and after: client-*.js 30748 B, produce-*.js 3863 B, both unchanged (the fix is in the compiler, not the runtime). Budget 0.1 kB.

- Estimated S, actual S.
