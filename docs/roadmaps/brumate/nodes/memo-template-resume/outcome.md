# Outcome: memo-template-resume

## Built

- The client finds a scope whose bound elements appear twice in the page while it indexes them: `indexElement` in `packages/brumate/src/runtime/client/blocks.ts` adds the scope to `sharedScopes` (`client/state.ts`, cleared in `leavePage`). `renderedTemplate` in `client/inserts.ts` skips such a scope, so each insert renders its own scope on its first update, as a browser render does.
- Tests in `packages/brumate/test/resume.test.ts`: `updates both inserts of a memo of a #template call after resume` (page `test/render/memoTemplateTwice.brm`) and a three-insert test (page `memoTemplateThrice.brm`).
- Differential entry `memo-template-twice` in `packages/brumate/test/differential/data.ts` for both pages.
- Patch changeset `.changeset/memo-template-resume.md`.

## Proof

- base: `cdf7f880`, `npx vitest run test/resume.test.ts -t "both inserts of a memo"` in `packages/brumate`. Fails: `.a` stays `1` while `.b` shows `2`.
- branch: the same command passes, and the three-insert test passes.

Cause: the server renders a memo of a template call once, so one scope (`2`) has two copies of its markup (`b-b="2:0"` twice). The client indexes elements by `b-b` key and keeps the last one, so an in-place update reaches `.b` only.

## Deviations

- The differential pages `memoTemplateTwice` and `memoTemplateThrice` stay accepted divergences. Their visible markup matches. Their slots differ: the server has one scope and a memo slot that holds markup, and the browser has one scope per insert and a memo slot that holds the call.
- Server fix sized and not built. Giving each insert its own scope on the server needs a lazy value in place of the rendered `Raw` of a template call. It touches: `codegen/patch.ts` (the memo body that calls a template), `runtime/server.ts` (`insert`, `Lazy`, and the page state serializer for a memo slot), and the client resume of a memo slot, which must turn the sent value into a `TemplateCall` for the slots to match at all. The same shape exists for any value that holds a template call (a `const`, a signal, a prop), so it is a larger change than M and a risk for a hotfix. The maintainer decides whether to schedule it as a feature node.

## Stubs left

- None.

## Gotchas

- Detection runs in the element index, so it needs the index to hold the whole page when a resumed insert first updates. This holds for resumed pages (the core indexes the page at start).
- A false positive only sends an insert to the re-render path, which is safe.
- Full runs of `packages/brumate` under load showed unrelated flakes (a ref loop test, `ResolveGoneChild`, `refLoop`, `style-files-postcss`). Each passes alone.

## Measurement

A resumed page with 300 rows, each `{row(i, n)}` for a `#template row`. Time from the click to the first update of every row (ms, three clicks in a row, loaded machine, `packages/brumate` vitest in happy-dom).

| Build                                          | First update              | Second | Third    |
| ---------------------------------------------- | ------------------------- | ------ | -------- |
| base (`cdf7f880`)                              | 61, 104, 288 (three runs) | 53     | 52 to 56 |
| first version, whole-document walk (`da1a895`) | 431, 595, 746             | 53     | 53       |
| this version, flag set while indexing          | 156, 157, 165             | 53     | 52 to 53 |

The first update on this version costs about 100 ms more than the quietest base run, measured on a loaded machine. Later updates do not change.

## Proposed learnings

- None.

## Verification

- `npx vitest run test/resume.test.ts test/differential-*.test.ts test/render.test.ts` in `packages/brumate`: see the PR comment for the result.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: see the PR comment for the result.

## Size

- Estimated M, actual M with the sized server fix left out.
- Risk estimated medium, measured medium.
