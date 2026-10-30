# Outcome: tokenfield-sync

## Built

- The box of a TokenField shows the first value after a form reset (also when the kept segments are the first ones, and after a composition), and after quick edits followed by a reset. The refused-edit case is NOT fixed: its test is `it.fails` and waits for the node bind-read-your-writes (a per-edit timer was dropped because it flickers and loses typing with a setter that accepts later).
- `TokenField.brm`: a `revision` counter in the context. A reset bumps it. `TokenInput.brm` reads it in its write effect, and writes it after a composition that a reset interrupted.
- `TokenInput.brm`: the stamps are keyed by text and by place among equal text, and carry `data-stamp=(text)`. `write()` copies a stamp only when its `data-stamp` matches the token, and shows the text otherwise. A retry a task later was tried and removed: no test or Chrome run needed it, and no test could reach it.
- Tests: `packages/ui/test/token-field-sync.test.ts` with `fixtures/token-field-sync.brm` (5 tests, one `it.fails`). Changeset `.changeset/tokenfield-sync.md` (patch).
- Docs: dropped the TokenField exception in `website/ui/state.md` and `website/ui/token-field.md`.

## Deviations

- `e2e/suites/website.mjs` is outside the brief's paths: a step on the token-field page does the refused edit and the quick edits with a reset in Chrome.
- The brief's refused-edit case waits for bind-read-your-writes; the docs say so.

## Stubs left

- None.

## Gotchas

- A stamp rendered by `#for ... by index` keeps old template content when its segment changes, so the content lagged even when `data-stamp` was new. Keys by text fix it; plain `by segment.text` breaks with the same token twice, so the key has the occurrence number.
- After `value = next` with a refusing `$bind` setter, the local `value` reads the new segments, so the refusal cannot be seen without a runtime read-back.

## Proposed learnings

- Key a `#for` of stamps by text and occurrence, not by index, when the content must follow the item | by index keeps old content | packages/ui/src | no

## Verification

- Before the fix the new case tests failed on main code; after, `npx vitest run test/token-field-sync.test.ts test/token-field.test.ts --maxWorkers=2` passes (20 tests with 1 expected fail, happy-dom).
- `pnpm lint` has no errors, `pnpm format:check` and `pnpm typecheck` pass.
- Chrome: see the e2e line in the PR description.

## Size

- Estimated S, actual S.
