# Outcome: memo-object-cast

## Built

- `arrowBody(code, source, start)` in packages/brumate/src/codegen/patch.ts wraps an arrow body in parentheses when the user's expression starts with `{` in the source.
- packages/brumate/src/codegen/client.ts uses it for the client memo and the debounced or throttled memo, in place of the `ObjectExpression` check.
- packages/brumate/test/codegen.test.ts: 7 cases in `memos of an object with a cast` (`as`, `satisfies`, plain object, `!`, parenthesized cast, sequence, conditional) that parse the server code and the client parts, and 2 cases for `$debounced` and an awaited object.
- .changeset/memo-object-cast.md (patch).

## Deviations

- Tests parse the generated code with `oxc-parser`. They do not run it in a browser, since the PARSE_ERROR comes from the generated code and not from the vite transform.

## Stubs left

- None.

## Gotchas

- The generated code cannot be checked for a leading `{`, because template markers can come first. Check the source.
- Server code, the early load and `$resolve` already wrapped their bodies, and tests cover the server code of all 7 cases.

## Proposed learnings

- None.

## Verification

- 6 of the 9 new cases fail on main and pass on this branch (the others already parsed).
- Client gzip size (`gzip -9` sum of `dist/client/**/*.js`, clean rebuild): examples/todos 39362 before, 39342 after. examples/ui 199371 before, 199352 after. The 20 bytes are run-to-run variation, since neither example has such a memo.

## Size

- Estimated S, actual S.
