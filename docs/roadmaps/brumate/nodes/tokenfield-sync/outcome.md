# Outcome: tokenfield-sync

## Built

- The box of a TokenField shows the kept value after a refused `$bind` write, after a form reset (also when the kept segments are the first ones), and after quick edits followed by a reset.
- `TokenField.brm`: a `revision` counter in the context. A reset bumps it. Each edit bumps it one task later, so a setter that refused leaves the box rewritten from the value. `TokenInput.brm` reads it in its write effect.
- `TokenInput.brm`: the stamps are keyed by text and by place among equal text, and carry `data-stamp=(text)`. `write()` copies a stamp only when its `data-stamp` matches the token, and writes again after a task when a stamp was not rendered yet.
- Tests: `packages/ui/test/token-field-sync.test.ts` with `fixtures/token-field-sync.brm` (4 tests). Changeset `.changeset/tokenfield-sync.md` (patch).
- Docs: dropped the TokenField exception in `website/ui/state.md` and `website/ui/token-field.md`.

## Deviations

- `e2e/suites/website.mjs` is outside the brief's paths: a step on the token-field page does the refused edit and the quick edits with a reset in Chrome.
- A setter that accepts late (a save after a delay) also gets its box rewritten from the old value for a moment: a refused write and a late one look the same to the field.

## Stubs left

- None.

## Gotchas

- A stamp rendered by `#for ... by index` keeps old template content when its segment changes, so the content lagged even when `data-stamp` was new. Keys by text fix it; plain `by segment.text` breaks with the same token twice, so the key has the occurrence number.
- After `value = next` with a refusing `$bind` setter, the local `value` reads the new segments, so the refusal cannot be seen in the same task.

## Proposed learnings

- Key a `#for` of stamps by text and occurrence, not by index, when the content must follow the item | by index keeps old content | packages/ui/src | no

## Verification

- Before the fix 3 of the 3 new case tests failed on main code; after, `npx vitest run test/token-field-sync.test.ts test/token-field.test.ts --maxWorkers=2` passes (19 tests, happy-dom).
- `pnpm lint` has no errors, `pnpm format:check` and `pnpm typecheck` pass.
- Chrome: see the e2e line in the PR description.

## Size

- Estimated S, actual S.
