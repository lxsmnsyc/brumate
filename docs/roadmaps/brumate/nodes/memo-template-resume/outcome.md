# Outcome: memo-template-resume

## Built

- `renderedTemplate` in `packages/brumate/src/runtime/client/inserts.ts` no longer links a resumed insert to a template scope whose markup also sits outside the range of the insert (new `hasMarkupOutside`). Such an insert renders its own scope on its first update, as a browser render does.
- Test `updates both inserts of a memo of a #template call after resume` in `packages/brumate/test/resume.test.ts`, page `packages/brumate/test/render/memoTemplateTwice.brm`.
- Differential entry `memo-template-twice` in `packages/brumate/test/differential/data.ts`.
- Patch changeset `.changeset/memo-template-resume.md`.

## Proof

- base: `cdf7f880`, `npx vitest run test/resume.test.ts -t "both inserts of a memo"` in `packages/brumate`. Fails: `.a` stays `1` while `.b` shows `2`.
- branch: the same command passes.

Cause: the server renders a memo of a template call once, so one scope (`2`) has two copies of its markup (`b-b="2:0"` twice). The client indexes elements by `b-b` key and keeps the last one, so an in-place update reaches `.b` only.

## Deviations

- The differential page `memoTemplateTwice` is listed as an accepted divergence, not a match. Its visible markup matches. Its slots differ: the server has one scope `2` and a memo slot holding markup, and the browser has two scopes and a memo slot holding the call. A server fix would need one render per insert, which is a larger change.

## Stubs left

- None.

## Gotchas

- The check walks the whole document on the first update of each resumed template insert. It looks at elements with `b-b` and `t`/`b` markers only. Portal markers (`P`) must not count: they broke `a spread onto a component` in the full file.
- Other flakes seen in full runs under load (a ref loop test, `ResolveGoneChild`, `refLoop`, `style-files-postcss`) passed alone.

## Proposed learnings

- None.

## Verification

- `pnpm lint`: no errors (warnings only). `pnpm format:check`: pass. `pnpm typecheck`: pass.
- `npx vitest run` in `packages/brumate`: 3614 to 3616 pass per run. One to three tests fail per run, a different set each time, and each passes alone.

## Size

- Estimated M, actual S.
- Risk estimated medium, measured medium. The check runs on every first update of a resumed template insert.
