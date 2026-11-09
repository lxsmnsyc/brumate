# Outcome: popover-sizing

## Built

- A Popover sets `max-height` to the room that is left on its side, and `overflow-y: auto` so the list scrolls (the Popover element scrolls; the ListBox inside has no height of its own) (packages/ui/src/position.ts, `followTrigger` with the new option `fitHeight`, which Popover passes; Tooltip does not). An inline `max-height` that is not ours, and a `max-height` from an author stylesheet, win.
- A Popover reads `--anchor-gap`, `--anchor-offset` and `--anchor-padding` for `offset`, `crossOffset` and `containerPadding` when the prop is not passed (packages/ui/src/Popover.brm, `$isPassed` for each). The values are read once, when it opens. A number or a pixel length works.
- New exports in position.ts: `parseLength`, `readLength`.
- Tests in packages/ui/test/position.test.ts: 8 new (length parsing, custom property read, inline and stylesheet max-height). Docs: website/ui/popover.md (Placement section).
- Changeset .changeset/popover-sizing.md (minor, @brumate/ui).

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- What the author's CSS sets (`max-height`, `overflow`) is read once, before the first write, so any non-`none` computed `max-height`, even from a browser or library rule, turns the fit off. Later updates only write when the room changes. `none` and `''` count as unset, since happy-dom returns `''`. Not run in a real browser.
- The `--anchor-*` values are read once, when it opens. `rem`, `em` and `%` are ignored; the prop default applies.

## Proposed learnings

- None.

## Verification

- `pnpm --filter @brumate/ui exec vitest run test/position.test.ts`: 13 passed.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`: pass. `pnpm --filter @brumate/ui test`: 77 files, 790 passed, 1 expected fail.
- Self review: 1 round, then a fresh review fixed in a second commit, no findings. e2e not run.

## Size

- Estimated S, actual S.
