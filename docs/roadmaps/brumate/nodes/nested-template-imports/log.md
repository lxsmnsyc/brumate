# Log: nested-template-imports

- Wrote the fixture templateNested.brm and the test of core-gaps.md section 3. It failed on main with `ReferenceError: TplDynamic is not defined`.
- Added templateNestedDeep.brm, with the template two blocks deep. It failed the same way.
- Changed `inside()` in src/codegen/client.ts to `!result.includes(template)`. Both tests pass.
- Measured the size before the fix: the compiler change does not alter the runtime chunks.
- The whole packages/brumate suite passes (942 passed, 5 expected fail).
