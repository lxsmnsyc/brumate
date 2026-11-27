# Log

## Proof on main (cdf7f880)

- Test: `updates both inserts of a memo of a #template call after resume` in `packages/brumate/test/resume.test.ts`, page `test/render/memoTemplateTwice.brm`.
- Command: `npx vitest run test/resume.test.ts -t "both inserts of a memo"` in `packages/brumate`.
- Result on main: fails, `expected '1' to be '2'` for `.a` after `.b` shows 2.

## Cause

- The server renders a memo of a template call once, so its Raw (one scope, `2`) is written at both inserts: the page has two spans `b-b="2:0"`.
- The client finds the elements of a scope by `b-b` key, and the index keeps the last one. `renderedTemplate` links the scope to the first insert and updates it in place, so only the last span changes.
- The browser render is correct because each insert of a TemplateCall renders its own scope.

## Fix

- `renderedTemplate` in `client/inserts.ts` gives up when markup of the scope sits outside the range of the insert. The insert then renders its own scope, as a browser render does.
