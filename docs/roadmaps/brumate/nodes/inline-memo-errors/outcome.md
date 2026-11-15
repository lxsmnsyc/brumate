# Outcome: inline-memo-errors

## Built

- A memo whose expression can throw by conversion (`big + 1`, `[big]`, a template with a part) keeps its error until a read, in the browser render and on the server.
- `cannotThrow` in packages/brumate/src/codegen/primitive.ts, copied from bfd1e98a (release/0.8, render-memo-reads).
- packages/brumate/src/codegen/patch.ts: `isPlainMemo` decides if the render computes a memo in place; any other memo goes through `renderMemo` and its reads through `readMemo`. A name that reads a memo counts as able to throw.
- packages/brumate/src/codegen/scopes.ts: `plainValues` also requires `cannotThrow`, so the server computes such a memo lazily.
- Changeset .changeset/inline-memo-errors.md (patch, brumate).

## Proof

- base: 64f67bc0, `pnpm --filter brumate exec vitest run test/resume.test.ts -t "cannot hold a value"`: the browser test times out (the `#catch` shows "Cannot mix BigInt and other types" and the child never renders), and the server test fails with the same `#catch`.
- branch: both tests pass. Reverting only patch.ts fails the browser test again; the server test fails without scopes.ts.

## Deviations

- The brief names the browser render only. The server inlined the same memo and threw at the declaration, so the acceptance "the server render agrees" needed the scopes.ts change.

## Stubs left

- None.

## Gotchas

- Cost: a memo such as `count * 2` is no longer a plain value. The render wraps it in `renderMemo`/`readMemo`, and the server computes it as a lazy memo (snapshots render/counter, memos, uses-counter changed). The todos bench is flat (client 78.6 kB / 27.7 kB gzip before and after; SSR renders/s within noise).
- The unit tests that used `id * 2`, `count * 3`, `count + 1` as a plain memo now use `===`.

## Merge note for release/0.8

- Merge main into release/0.8: primitive.ts should merge cleanly (same `cannotThrow` text). patch.ts conflicts with render-memo-reads: take the 0.8 side (`cannotThrow`-based `memoNow`/`heldMemos`) and drop `isPlainMemo`; keep the rule that a name reading a memo counts as throwing if 0.8 does not already treat it that way.
- scopes.ts `plainValues` has no counterpart in 0.8 (it did not touch the server). Keep the `cannotThrow` line there, or the server throws at the declaration again. On 0.8 the cost of lazy server memos for `count * 2` also applies; decide there if that is wanted.
- Re-take the three render snapshots from 0.8 output after the merge.

## Proposed learnings

- A memo whose expression converts values must not be computed where it is declared | the conversion can throw and the doc says a memo holds its error until a read | packages/brumate/src/codegen | yes (the resume test)

## Verification

- Targeted: resume "cannot hold a value", codegen.test.ts, render.test.ts pass. Full brumate vitest: 3 load flakes (render, resume x2, search-params) pass alone; typecheck clean; oxlint no errors; format only fails on editor-sizes/brief.md (on the base).

## Size

- Estimated S, actual M. The server needed the same change, and the snapshots changed.
