# Outcome: setter-ref-resume-rest

## Built

- A `ref=$bind(x, fn)` that reaches an element through the rest props of a component calls `fn` once on resume with the server-rendered element.
- Server: `restRef` in runtime/server.ts writes the setter to the new record field `r` (by anchor) of the scope that spreads the rest.
- Client: `addScopes` in runtime/client/resume.ts calls `give` for each entry of `r`. `give` (runtime/client/updates.ts) wraps `send` with the `given` dedupe, which `forwardRef` in inserts.ts now uses too, so a spread update does not call `fn` again.
- `ScopeState.r` and its row in `SCOPE_IDS` (runtime/shared.ts).
- Tests: the rest-props test in packages/brumate/test/resume.test.ts now expects one call on resume, one for a block and no more. "does not call the setter again when the spread updates" covers the dedupe after resume. scope-ids.test.ts has `r` in its full record.
- Changeset `.changeset/setter-ref-resume-rest.md` (patch, brumate).

## Deviations

- Edited runtime/shared.ts and packages/brumate/test/scope-ids.test.ts, outside the shared paths: a new `ScopeState` field must be in `SCOPE_IDS`, and the test lists every field.

## Stubs left

- None.

## Gotchas

- A record with `r` is not packed (like `b`), so a group of such scopes is written as plain records.
- `addScopes` looks for the element when the record is read, as for named props. A streamed record whose markup is not in the page yet gets no call.

## Proposed learnings

- None.

## Verification

- `pnpm --filter brumate exec vitest run test/resume.test.ts -t "a ref bound with a setter"`: 6 pass (the rest-props test failed with the old expectation changed to a call on resume before the fix).
- Fast and full checks: see the pull request.

## Size

- todos build, gzip -9 of every client js, base then head: 38986 to 38993 B (+7 B), within 0.3 kB.
- Estimated S, actual S.
