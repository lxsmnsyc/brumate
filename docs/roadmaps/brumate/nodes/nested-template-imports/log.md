# Log: nested-template-imports

- Wrote the fixture templateNested.brm and the test of core-gaps.md section 3. It failed on main with `ReferenceError: TplDynamic is not defined`.
- Added templateNestedDeep.brm, with the template two blocks deep. It failed the same way.
- Changed `inside()` in src/codegen/client.ts to `!result.includes(template)`. Both tests pass.
- Measured the size before the fix: the compiler change does not alter the runtime chunks.
- Review: the nested template was emitted twice. Added `declared()` for emission, and fixtures for a template in a template, called twice, and for a template in an `#if` in a `#for`. The tests count the declared functions, and fail without `declared()`.
