# Outcome: untrack-prop-value

## Built

- `isFunctionValue` in packages/brumate/src/graph.ts sees through an unbound `$untrack(fn)`. A prop value `$untrack(nameOf)` is a function prop: the function ships as a client handler, the prop stays fixed, and writes to the state it reads compile to real writes.
- Meaning chosen: `$untrack(fn)` as a prop value keeps the prop fixed and still passes the function. It is not a compile error, since the rewrite to `(fn)` already existed and the call is harmless.
- Test: "keeps the function and the writes when $untrack wraps a prop value" in packages/brumate/test/resume.test.ts, with fixtures fnUntrackProp.brm and FnUntrackChild.brm. It fails on main (the server cannot serialize the function) and passes now.
- Patch changeset .changeset/untrack-prop-value.md.

## Deviations

- The commit subject is shorter than the one given (72 character limit of the plain-writing hook).

## Stubs left

- None.

## Gotchas

- The older `fnReadUntrack` test covers `$untrack` inside the function, a different case.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "untrack"`: 2 passed. The new test fails with the fix removed.

## Size

- Estimated S, actual S.
