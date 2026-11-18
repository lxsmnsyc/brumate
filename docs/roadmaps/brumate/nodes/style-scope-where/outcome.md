# Outcome: style-scope-where

## Built

- `scopeSelector` in `packages/brumate/src/css.ts` now inserts `:where([b-c-<hash>])` in place of `[b-c-<hash>]` for every scoped compound. File styles and block styles share the function, so both change. `targets` and `needsScope` are unchanged.
- Tests: regexes and expected strings in `test/styles.test.ts` and `test/styles/block-styles.test.ts` updated, `test/__snapshots__/render/styled.txt` and `offscreen.txt` regenerated.
- New `test/styles/scope-specificity-browser.test.ts` (happy-dom): a later global rule of equal written specificity (`.card .note`) overrides the scoped one. It fails when the scope is a bare attribute (checked).
- `website/docs/styles.md` says scoping adds no specificity. `docs/decisions.md` records the rule.
- Changeset `.changeset/scope-where.md`, minor.

## Deviations

None. Only brief paths and this node folder changed.

## Stubs left

None.

## Gotchas

- Any code or test that matches the scoped output with a string or regex such as `.tag[b-c-x]` must now expect `.tag:where([b-c-x])`.
- `pnpm typecheck` needs a full `pnpm build` first (`packages/tsc/dist`), not only `pnpm --filter brumate build`.
- `test/differential-1.test.ts` `refLoop (known divergence)` failed once under load in the root run and passed alone.

## Verification

- brumate styles tests and render tests: pass. `pnpm --filter website test`: 345 pass.
- Root: `pnpm lint` (warnings only, none new), `pnpm format:check` pass, `pnpm typecheck` after `pnpm build`, `pnpm test` (see log; one load flake rerun alone).

## Size

Website home CSS (all `<style>` text of `dist/client/index.html`, 220 scoped compounds): 46822 B to 48582 B raw (+1760 B, 8 B a compound), gzip level 9 9261 B to 9320 B (+59 B).
