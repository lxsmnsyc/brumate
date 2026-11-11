# Outcome: popover-tab-out

## Built

- `leaveByTab(panel, trigger, event)` in packages/ui/src/overlay.ts, the same code and signature as on batch/brumate-release-0.8.
- packages/ui/src/Popover.brm calls it from the keydown of every non-modal popover (`isNonModal` or a non-modal trigger, not previews). Tab from the last element goes to the element after the trigger, Shift+Tab from the first goes to the trigger, and `blurOutside` closes the popover. Modal popovers keep `containTab`.
- Tests in packages/ui/test/popover.test.ts, patch changeset .changeset/popover-tab-out.md.
- Prior art: Headless UI popover.tsx at fe9ec1793f17 (see log.md).

## Proof

- base: af581bbf, `pnpm --filter @brumate/ui exec vitest run test/popover.test.ts`: the two new tests fail (2 failed, 24 passed).
- branch: same command, 26 passed.

## Deviations

- None. The fixture was not changed.

## Gotchas

- Merge into release/0.8: both sides add `leaveByTab` to overlay.ts, identical, so keep one copy. In Popover.brm, the 0.8 keyDown condition is `group && (isNonModal || trigger?.isNonModal)`. Drop `group &&` and keep one block (this branch adds `!trigger?.isPreview`). Keep `leaveByTab` once in the import list.
- `leaveByTab` skips elements in any `[data-layer]` after the trigger, so a trigger inside a dialog layer skips the rest of that dialog. Same as 0.8.
- The keydown handler attaches after the page code loads, so tests retry inside `waitFor`.

## Proposed learnings

- None.

## Verification

- `pnpm --filter @brumate/ui exec vitest run`: 801 passed, 1 expected fail.
- `node e2e/run.mjs --only ui`: 57 passed.
- `pnpm exec oxlint`: warnings only. `pnpm --filter @brumate/ui typecheck`: ok.
- `pnpm format:check`: one file fails, docs/roadmaps/brumate/nodes/editor-sizes/brief.md, not part of this node.

## Size

- Estimated S, actual S.
